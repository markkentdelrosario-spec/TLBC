import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

async function mockGet(page, path, handler) {
  await page.route('**/*', (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    if (
      request.method() === 'GET' &&
      request.resourceType() !== 'document' &&
      requestUrl.pathname.replace(/\/+$/, '').endsWith(path)
    ) {
      return handler(route);
    }
    return route.continue();
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('public home page exposes primary navigation and passes automated accessibility checks', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'The Life Builder Church' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Events', exact: true })).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('events page renders public events returned by the API', async ({ page }) => {
  await mockGet(page, '/events', (route) =>
    route.fulfill({
      json: {
        events: [{
          _id: 'community-day',
          title: 'Community Day',
          description: 'A day to connect with neighbors.',
          eventDate: '2099-12-01T00:00:00.000Z',
          startTime: '10:00',
          location: 'Church Hall',
          category: 'Outreach',
        }],
      },
    })
  );

  await page.goto('/events?eventId=community-day');
  await expect(page.getByRole('heading', { name: 'Church events' })).toBeVisible();
  await expect(page.getByText('Community Day', { exact: true })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Add Community Day to calendar' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('community-day.ics');
  const calendar = await readFile(await download.path(), 'utf8');
  expect(calendar).toContain('SUMMARY:Community Day');
});

test('public events page offers retry after a failed request', async ({ page }) => {
  let requests = 0;
  await mockGet(page, '/events', (route) => {
    requests += 1;
    if (requests === 1) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Events are temporarily unavailable.' }),
      });
    }
    return route.fulfill({ json: { events: [] } });
  });

  await page.goto('/events');
  await expect(page.getByRole('alert')).toContainText('Events are temporarily unavailable.');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(requests).toBe(2);
});

test('ministries page renders published ministry descriptions', async ({ page }) => {
  await mockGet(page, '/ministries', (route) =>
    route.fulfill({
      json: {
        ministries: [{
          slug: 'worship-ministry',
          name: 'Worship Ministry',
          description: 'Serve through music and worship.',
        }],
      },
    })
  );

  await page.goto('/ministries');
  await expect(page.getByRole('heading', { name: /There’s room for you to belong and serve/ })).toBeVisible();
  await expect(page.getByText('Serve through music and worship.')).toBeVisible();
});

test('unauthenticated dashboard access redirects to sign in', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'WELCOME BACK !' })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
});

test('public pages show and clear the connection-lost notice', async ({ page, context }) => {
  await mockGet(page, '/events', (route) =>
    route.fulfill({ json: { events: [] } })
  );
  await page.goto('/events');
  await expect(page.getByRole('heading', { name: 'Church events' })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole('status')).toContainText('Your device appears to be offline.');
  await context.setOffline(false);
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('signed-in members can save Bible passages and track reading plan progress', async ({ page }) => {
  const savedBookmarks = [];
  const planProgress = [];

  await page.route('**/*', async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    if (requestUrl.hostname === 'identitytoolkit.googleapis.com') {
      if (requestUrl.pathname.endsWith('/accounts:signInWithPassword')) {
        return route.fulfill({
          json: {
            localId: 'e2e-member',
            email: 'member@example.test',
            displayName: 'Test Member',
            idToken: 'e2e-token',
            refreshToken: 'e2e-refresh-token',
            expiresIn: '3600',
            registered: true,
          },
        });
      }
      if (requestUrl.pathname.endsWith('/accounts:lookup')) {
        return route.fulfill({
          json: {
            users: [{
              localId: 'e2e-member',
              email: 'member@example.test',
              displayName: 'Test Member',
              emailVerified: true,
              providerUserInfo: [{ providerId: 'password' }],
              createdAt: '2026-01-01T00:00:00.000Z',
            }],
          },
        });
      }
    }

    if (requestUrl.hostname === 'bible-api.com') {
      return route.fulfill({
        json: {
          reference: 'John 1:1',
          translation_name: 'World English Bible',
          verses: [{ verse: 1, text: 'In the beginning was the Word.' }],
        },
      });
    }

    if (requestUrl.pathname.startsWith('/api/')) {
      const path = requestUrl.pathname;
      if (path === '/api/auth/register') {
        return route.fulfill({ json: { message: 'Profile synchronized.' } });
      }
      if (path === '/api/auth/me') {
        return route.fulfill({
          json: {
            _id: 'member-001',
            name: 'Test Member',
            email: 'member@example.test',
            role: 'member',
            groupName: 'KSP 1',
          },
        });
      }
      if (path === '/api/attendance/my-summary') {
        return route.fulfill({
          json: {
            attendanceCount: 1,
            recentAttendance: [{
              date: '2026-11-16',
              serviceName: 'Sunday Worship',
              groupName: 'KSP 1',
              checkedInAt: '2026-11-16T00:30:00.000Z',
            }],
          },
        });
      }
      if (path === '/api/bible-library' && request.method() === 'GET') {
        return route.fulfill({
          json: {
            plans: [{
              id: 'gospel-of-john',
              title: 'Seven Days in the Gospel of John',
              description: 'Read one chapter from John each day.',
              days: Array.from({ length: 7 }, (_, index) => ({
                dayNumber: index + 1,
                reference: `John ${index + 1}`,
              })),
            }],
            bookmarks: savedBookmarks,
            planProgress,
          },
        });
      }
      if (path === '/api/bible-library/bookmarks' && request.method() === 'POST') {
        const bookmark = {
          _id: 'bookmark-001',
          ...request.postDataJSON(),
        };
        savedBookmarks.unshift(bookmark);
        return route.fulfill({ status: 201, json: { bookmark } });
      }
      if (path === '/api/bible-library/plans/gospel-of-john' && request.method() === 'PUT') {
        let progress = planProgress.find((item) => item.planId === 'gospel-of-john');
        if (!progress) {
          progress = { _id: 'progress-001', planId: 'gospel-of-john', completedDayNumbers: [] };
          planProgress.push(progress);
        }
        return route.fulfill({ json: { progress } });
      }
      if (
        path === '/api/bible-library/plans/gospel-of-john/days/1' &&
        request.method() === 'PATCH'
      ) {
        const progress = planProgress[0];
        progress.completedDayNumbers = progress.completedDayNumbers.includes(1) ? [] : [1];
        return route.fulfill({ json: { progress } });
      }
      if (path === '/api/announcements') {
        return route.fulfill({ json: { announcements: [], page: 1, totalPages: 1 } });
      }
      if (path === '/api/notifications') {
        return route.fulfill({
          json: { notifications: [], unreadCount: 0, page: 1, totalPages: 1 },
        });
      }
      if (path === '/api/birthdays') {
        return route.fulfill({ json: { birthdays: [], page: 1, totalPages: 1 } });
      }
      if (path === '/api/verse-of-day') {
        return route.fulfill({
          json: {
            date: '2026-11-16',
            reference: 'Psalm 23:1',
            reactionCount: 0,
            reacted: false,
          },
        });
      }
      return route.fulfill({ json: {} });
    }

    return route.continue();
  });

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill('member@example.test');
  await page.getByLabel('Password', { exact: true }).fill('e2e-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: 'Personal attendance' })).toBeVisible();
  await expect(page.getByText('Nov 16, 2026')).toBeVisible();

  await page.getByLabel('Bible passage reference').fill('John 1');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(
    page.locator('#bible-reader').getByText('John 1:1', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save passage' }).click();
  await expect(page.getByRole('heading', { name: 'Saved passages' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'John 1:1 web' })).toBeVisible();

  await page.getByRole('button', { name: 'Start plan' }).click();
  await page.getByRole('button', { name: 'Mark complete', exact: true }).first().click();
  await expect(page.getByText('1 of 7 days complete')).toBeVisible();
});
