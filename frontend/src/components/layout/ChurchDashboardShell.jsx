import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiRequest, getErrorMessage } from '../../services/api';
import {
  getDesignations,
  hasDesignation,
  hasLeadershipDesignation,
} from '../../utils/designations';
import { LOCAL_WELCOME_SLIDES } from '../../utils/localSlideshow';
import {
  hasRegisteredPushToken,
  listenForPushMessages,
  registerPushNotifications,
  removePushNotifications,
} from '../../services/pushNotifications';
import MemberQRCode from '../member/MemberQRCode';
import AttendanceReportsPanel from '../admin/AttendanceReportsPanel';
import ThemeToggle from '../shared/ThemeToggle';
import ImageUpload from '../shared/ImageUpload';
import ConfirmationModal from '../shared/ConfirmationModal';
import AttendanceMonitoringPanel from '../attendance/AttendanceMonitoringPanel';

const BIBLE_TRANSLATIONS = [
  ['web', 'World English Bible (WEB)'],
  ['kjv', 'King James Version (KJV)'],
  ['nkjv', 'New King James Version (NKJV)'],
  ['nlt', 'New Living Translation (NLT)'],
  ['niv', 'New International Version (NIV)'],
  ['asv', 'American Standard Version (ASV)'],
  ['bbe', 'Bible in Basic English (BBE)'],
  ['darby', 'Darby Bible'],
  ['ylt', 'Young’s Literal Translation (YLT)'],
  ['oeb-us', 'Open English Bible (US)'],
];

const BIBLE_BOOKS = [
  ['Genesis', 50], ['Exodus', 40], ['Leviticus', 27], ['Numbers', 36],
  ['Deuteronomy', 34], ['Joshua', 24], ['Judges', 21], ['Ruth', 4],
  ['1 Samuel', 31], ['2 Samuel', 24], ['1 Kings', 22], ['2 Kings', 25],
  ['1 Chronicles', 29], ['2 Chronicles', 36], ['Ezra', 10], ['Nehemiah', 13],
  ['Esther', 10], ['Job', 42], ['Psalms', 150], ['Proverbs', 31],
  ['Ecclesiastes', 12], ['Song of Solomon', 8], ['Isaiah', 66], ['Jeremiah', 52],
  ['Lamentations', 5], ['Ezekiel', 48], ['Daniel', 12], ['Hosea', 14],
  ['Joel', 3], ['Amos', 9], ['Obadiah', 1], ['Jonah', 4], ['Micah', 7],
  ['Nahum', 3], ['Habakkuk', 3], ['Zephaniah', 3], ['Haggai', 2],
  ['Zechariah', 14], ['Malachi', 4], ['Matthew', 28], ['Mark', 16],
  ['Luke', 24], ['John', 21], ['Acts', 28], ['Romans', 16],
  ['1 Corinthians', 16], ['2 Corinthians', 13], ['Galatians', 6], ['Ephesians', 6],
  ['Philippians', 4], ['Colossians', 4], ['1 Thessalonians', 5],
  ['2 Thessalonians', 3], ['1 Timothy', 6], ['2 Timothy', 4], ['Titus', 3],
  ['Philemon', 1], ['Hebrews', 13], ['James', 5], ['1 Peter', 5],
  ['2 Peter', 3], ['1 John', 5], ['2 John', 1], ['3 John', 1],
  ['Jude', 1], ['Revelation', 22],
];

const navItems = [
  { label: 'Dashboard', href: '#dashboard', icon: '⌂' },
  { label: 'Inbox', href: '#announcements', icon: '✉' },
  { label: 'Lessons / Bible', href: '#bible-reader', icon: '▤' },
  { label: 'Tasks', href: '#ministry-media', icon: '☑' },
  { label: 'Groups', href: '#groups', icon: '♧' },
];

const API_BIBLE_TRANSLATIONS = {
  nkjv: 'NKJV',
  nlt: 'NLT',
  niv: 'NIV',
};
const apiBibleRequests = new Map();

async function fetchApiBibleReference(reference, translation) {
  const abbreviation = API_BIBLE_TRANSLATIONS[translation];
  const apiKey = import.meta.env.VITE_API_BIBLE_KEY;
  if (!apiKey) {
    throw new Error(`${abbreviation} requires an API.Bible key. Configure VITE_API_BIBLE_KEY and enable ${abbreviation} for the key.`);
  }
  const request = async (path) => {
    const response = await fetch(`https://api.scripture.api.bible/v1${path}`, {
      headers: { 'api-key': apiKey },
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(payload.message || payload.error || `The ${abbreviation} Bible service is unavailable.`);
    }
    return payload.data;
  };
  if (!apiBibleRequests.has(abbreviation)) {
    const bibleRequest = request(
      `/bibles?language=eng&abbreviation=${encodeURIComponent(abbreviation)}`
    )
      .then((data) => {
        const bible = data?.find((item) =>
          item.abbreviation?.toUpperCase() === abbreviation ||
          item.name?.toUpperCase().includes(abbreviation)
        );
        if (!bible) {
          throw new Error(`The configured API.Bible key does not have access to ${abbreviation}.`);
        }
        return bible;
      })
      .catch((error) => {
        apiBibleRequests.delete(abbreviation);
        throw error;
      });
    apiBibleRequests.set(abbreviation, bibleRequest);
  }
  const bible = await apiBibleRequests.get(abbreviation);
  const match = reference.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (!match) {
    throw new Error('Enter a Bible reference such as John 3, John 3:16, or John 3:16-18.');
  }
  const [, bookName, chapter, firstVerse, lastVerse] = match;
  const books = await request(`/bibles/${encodeURIComponent(bible.id)}/books`);
  const book = books?.find((item) =>
    item.name?.toLowerCase() === bookName.toLowerCase() ||
    item.abbreviation?.toLowerCase() === bookName.toLowerCase()
  );
  if (!book) throw new Error(`The ${abbreviation} book "${bookName}" was not found.`);
  const start = `${book.id}.${chapter}${firstVerse ? `.${firstVerse}` : ''}`;
  const end = lastVerse ? `-${book.id}.${chapter}.${lastVerse}` : '';
  const passage = await request(
    `/bibles/${encodeURIComponent(bible.id)}/passages/${encodeURIComponent(`${start}${end}`)}?content-type=text`
  );
  const content = Array.isArray(passage.content)
    ? passage.content.map((item) => typeof item === 'string' ? item : item.text || '').join('')
    : passage.content || '';
  return {
    reference: passage.reference || reference,
    text: content.replace(/<[^>]*>/g, '').trim(),
    translation_name: bible.name || abbreviation,
  };
}

function isReacted(reactions, userId) {
  return (reactions || []).some((reaction) => {
    const reactionUser = typeof reaction === 'string'
      ? reaction
      : reaction.user?._id || reaction.user || reaction._id;
    return String(reactionUser) === String(userId);
  });
}

function monthDay(date) {
  return new Date(date).getUTCDate();
}

function VerseOfDayCard({
  id,
  className = '',
  verse,
  verseError,
  verseReaction,
  onToggleReaction,
}) {
  return (
    <section
      id={id}
      className={`relative overflow-hidden rounded-2xl bg-cover bg-center p-5 text-center text-white shadow-sm ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(27,35,51,.55), rgba(27,35,51,.84)), url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80')",
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">Verse of the day</p>
      {verse ? (
        <>
          <p className="mt-4 font-serif text-lg leading-7 text-white sm:text-xl">
            “{verse.text?.trim()}”
          </p>
          <p className="mt-3 text-xs font-bold tracking-wide text-white/90">{verse.reference}</p>
          <button
            type="button"
            onClick={onToggleReaction}
            aria-label={verseReaction.reacted ? 'Unlike verse of the day' : 'Like verse of the day'}
            aria-pressed={verseReaction.reacted}
            className={`mt-4 inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
              verseReaction.reacted
                ? 'border-rose-200/50 bg-rose-500/90 text-white'
                : 'border-white/30 bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <span aria-hidden="true" className="text-sm">{verseReaction.reacted ? '♥' : '♡'}</span>
            {verseReaction.reactionCount}
          </button>
        </>
      ) : (
        <p className="mt-3 text-xs leading-5 text-white/80">{verseError || 'Loading today’s scripture…'}</p>
      )}
    </section>
  );
}

export default function ChurchDashboardShell({
  children,
  apiBaseUrl = '/api',
  getIdToken,
}) {
  const { user, firebaseUser, logout, refreshProfile, changePassword, setPassword } = useAuth();
  const { showToast } = useToast();
  const isKspLeader =
    user?.role === 'member' &&
    hasDesignation(user, 'KSP Leader');
  const settingsRef = useRef(null);
  const notificationsRef = useRef(null);
  const bibleRequestVersion = useRef(0);
  const notificationIds = useRef(new Set());
  const notificationsOpenRef = useRef(false);
  const [announcements, setAnnouncements] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [attendanceLeaderboard, setAttendanceLeaderboard] = useState([]);
  const [verse, setVerse] = useState(null);
  const [verseError, setVerseError] = useState('');
  const [readerReference, setReaderReference] = useState('');
  const [readerBook, setReaderBook] = useState('John');
  const [readerChapter, setReaderChapter] = useState(1);
  const [bibleTranslation, setBibleTranslation] = useState('web');
  const [readerVerse, setReaderVerse] = useState(null);
  const [readerError, setReaderError] = useState('');
  const [readerLoading, setReaderLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [slide, setSlide] = useState(0);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [actionError, setActionError] = useState('');
  const [media, setMedia] = useState([]);
  const [leadershipGroup, setLeadershipGroup] = useState(null);
  const [groupError, setGroupError] = useState('');
  const [smallGroup, setSmallGroup] = useState(null);
  const [smallGroupLoading, setSmallGroupLoading] = useState(false);
  const [smallGroupError, setSmallGroupError] = useState('');
  const [smallGroupMessage, setSmallGroupMessage] = useState('');
  const [smallGroupMemberRemoving, setSmallGroupMemberRemoving] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState({});
  const [groupMemberBusy, setGroupMemberBusy] = useState(false);
  const [teamMemberRemoving, setTeamMemberRemoving] = useState('');
  const [groupMemberMessage, setGroupMemberMessage] = useState('');
  const [groupMemberError, setGroupMemberError] = useState('');
  const cancelConfirmation = useCallback(() => setConfirmation(null), []);
  const confirmPendingAction = useCallback(() => {
    const action = confirmation?.onConfirm;
    setConfirmation(null);
    action?.();
  }, [confirmation]);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [mediaNotice, setMediaNotice] = useState('');
  const [announcementDraft, setAnnouncementDraft] = useState({ title: '', body: '' });
  const [verseReaction, setVerseReaction] = useState({ reacted: false, reactionCount: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const welcomeSlides = LOCAL_WELCOME_SLIDES;
  const [welcomeIndex, setWelcomeIndex] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    displayName: user?.name || '',
    phoneNumber: user?.phoneNumber || '',
    birthDate: user?.birthDate ? String(user.birthDate).slice(0, 10) : '',
  });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    if (actionError) showToast(actionError, 'error');
  }, [actionError, showToast]);

  useEffect(() => {
    if (mediaError) showToast(mediaError, 'error');
  }, [mediaError, showToast]);

  useEffect(() => {
    if (mediaNotice) showToast(mediaNotice, 'success');
  }, [mediaNotice, showToast]);

  useEffect(() => {
    if (profileError) showToast(profileError, 'error');
  }, [profileError, showToast]);

  useEffect(() => {
    if (profileNotice) showToast(profileNotice, 'success');
  }, [profileNotice, showToast]);

  const loadAnnouncements = useCallback(async () => {
    const result = await apiRequest('/announcements', { getIdToken, apiBaseUrl });
    setAnnouncements(Array.isArray(result) ? result : result.announcements || []);
  }, [apiBaseUrl, getIdToken]);

  const loadNotifications = useCallback(async () => {
    const result = await apiRequest('/notifications', { getIdToken, apiBaseUrl });
    notificationIds.current = new Set(
      (result.notifications || []).map((notification) => String(notification._id))
    );
    setNotifications(result.notifications || []);
    setUnreadNotificationCount(result.unreadCount || 0);
  }, [apiBaseUrl, getIdToken]);

  const loadBirthdays = useCallback(async () => {
    const result = await apiRequest('/birthdays', { getIdToken, apiBaseUrl });
    setBirthdays(result.birthdays || []);
  }, [apiBaseUrl, getIdToken]);

  const loadMedia = useCallback(async () => {
    const result = await apiRequest('/upload/ministry-media', {
      getIdToken,
      apiBaseUrl,
    });
    setMedia(result.media || []);
  }, [apiBaseUrl, getIdToken]);

  const loadSmallGroup = useCallback(async () => {
    setSmallGroup(null);
    setSmallGroupLoading(true);
    setSmallGroupError('');
    try {
      const result = await apiRequest('/groups/my-group', {
        getIdToken,
        apiBaseUrl,
      });
      setSmallGroup(result);
    } catch (error) {
      setSmallGroupError(getErrorMessage(error));
    } finally {
      setSmallGroupLoading(false);
    }
  }, [apiBaseUrl, getIdToken]);

  useEffect(() => {
    setPushEnabled(hasRegisteredPushToken(user?._id));
  }, [user?._id]);

  useEffect(() => {
    if (!user?._id) return undefined;
    let active = true;
    loadNotifications().catch((error) => {
      if (active) setActionError(getErrorMessage(error));
    });
    return () => {
      active = false;
    };
  }, [loadNotifications, user?._id]);

  useEffect(() => {
    if (!user?._id || typeof getIdToken !== 'function') return undefined;
    let socket;
    let active = true;

    getIdToken()
      .then(() => {
        if (!active) return;
        const configuredUrl = import.meta.env.VITE_SOCKET_URL;
        const socketUrl = configuredUrl
          ? configuredUrl
          : apiBaseUrl.startsWith('http')
            ? new URL(apiBaseUrl).origin
            : window.location.origin;
        socket = io(socketUrl, {
          auth: (callback) => {
            getIdToken()
              .then((token) => callback({ token }))
              .catch((error) => {
                console.error('Unable to refresh the real-time connection token.', error);
                callback({ token: '' });
              });
          },
          transports: ['websocket', 'polling'],
        });
        socket.on('connect', () => {
          Promise.all([loadAnnouncements(), loadBirthdays(), loadNotifications()])
            .catch((error) => setActionError(getErrorMessage(error)));
          apiRequest('/verse-of-day', { getIdToken, apiBaseUrl })
            .then((metadata) => {
              setVerse((current) => current
                ? { ...current, metadata: { ...current.metadata, ...metadata } }
                : current);
              setVerseReaction({
                reacted: metadata.reacted,
                reactionCount: metadata.reactionCount,
              });
            })
            .catch((error) => setActionError(getErrorMessage(error)));
        });
        socket.on('announcement:published', () => {
          loadAnnouncements().catch((error) => setActionError(getErrorMessage(error)));
        });
        socket.on('attendance:recorded', () => {
          window.dispatchEvent(new CustomEvent('tlbc:attendance-recorded'));
          const requests = [
            apiRequest('/analytics/leaderboard', { getIdToken, apiBaseUrl }),
          ];
          if (user?.role === 'admin') {
            requests.push(apiRequest('/analytics/summary', { getIdToken, apiBaseUrl }));
          }
          Promise.all(requests)
            .then(([leaderboard, summary]) => {
              setAttendanceLeaderboard(leaderboard.members || []);
              if (summary) setAnalytics(summary);
            })
            .catch((error) => setActionError(getErrorMessage(error)));
        });
        socket.on('announcement:reaction', ({ announcementId, userIds }) => {
          setAnnouncements((items) =>
            items.map((item) =>
              String(item._id || item.id) === String(announcementId)
                ? { ...item, reactions: userIds.map((id) => ({ user: { _id: id } })) }
                : item
            )
          );
        });
        socket.on('announcement:comment', () => {
          loadAnnouncements().catch((error) => setActionError(getErrorMessage(error)));
        });
        socket.on('comment:reaction', (event) => {
          if (event.scope === 'announcement') {
            setAnnouncements((items) =>
              items.map((item) =>
                String(item._id || item.id) === String(event.announcementId)
                  ? {
                      ...item,
                      comments: (item.comments || []).map((comment) =>
                        String(comment._id) === String(event.commentId)
                          ? { ...comment, reactions: event.userIds }
                          : comment
                      ),
                    }
                  : item
              )
            );
          } else if (event.scope === 'birthday') {
            setBirthdays((items) =>
              items.map((item) =>
                String(item.id) === String(event.celebrantId)
                  ? {
                      ...item,
                      comments: (item.comments || []).map((comment) =>
                        String(comment._id) === String(event.commentId)
                          ? { ...comment, reactions: event.userIds }
                          : comment
                      ),
                    }
                  : item
              )
            );
          }
        });
        socket.on('birthday:reaction', ({ celebrantId, userIds }) => {
          setBirthdays((items) =>
            items.map((item) =>
              String(item.id) === String(celebrantId)
                ? { ...item, reactions: userIds }
                : item
            )
          );
        });
        socket.on('birthday:comment', () => {
          loadBirthdays().catch((error) => setActionError(getErrorMessage(error)));
        });
        socket.on('verse:reaction', ({ dateKey, userIds }) => {
          setVerse((current) => current?.metadata?.date === dateKey
            ? {
                ...current,
                metadata: {
                  ...current.metadata,
                  reactionCount: userIds.length,
                  reacted: userIds.includes(String(user?._id)),
                },
              }
            : current);
          setVerseReaction({
            reactionCount: userIds.length,
            reacted: userIds.includes(String(user?._id)),
          });
        });
        socket.on('notification:new', (notification) => {
          const notificationId = String(notification._id);
          const isNew = !notificationIds.current.has(notificationId);
          notificationIds.current.add(notificationId);
          const hasBeenViewed = notificationsOpenRef.current;
          const entry = hasBeenViewed
            ? { ...notification, readAt: new Date().toISOString() }
            : notification;
          setNotifications((items) => [
            entry,
            ...items.filter((item) => String(item._id) !== notificationId),
          ].slice(0, 50));
          if (isNew && !notification.readAt && !hasBeenViewed) {
            setUnreadNotificationCount((count) => count + 1);
          }
          if (isNew && !notification.readAt && hasBeenViewed) {
            apiRequest(`/notifications/${notificationId}/read`, {
              getIdToken,
              apiBaseUrl,
              method: 'PATCH',
            }).catch((error) => setActionError(getErrorMessage(error)));
          }
        });
        socket.on('notifications:read', ({ all, notificationId, unreadCount }) => {
          setNotifications((items) => items.map((item) =>
            all || String(item._id) === String(notificationId)
              ? { ...item, readAt: item.readAt || new Date().toISOString() }
              : item
          ));
          setUnreadNotificationCount(unreadCount || 0);
        });
        socket.on('connect_error', (error) => {
          console.error('Real-time dashboard updates are unavailable.', error.message);
        });
      })
      .catch((error) => {
        if (active) console.error('Unable to authenticate real-time dashboard updates.', error);
      });

    return () => {
      active = false;
      socket?.disconnect();
    };
  }, [
    apiBaseUrl,
    getIdToken,
    loadAnnouncements,
    loadBirthdays,
    user?._id,
    user?.role,
  ]);

  useEffect(() => {
    let active = true;
    let unsubscribe;
    listenForPushMessages(() => {
      loadNotifications().catch((error) => setActionError(getErrorMessage(error)));
    })
      .then((stopListening) => {
        if (active) unsubscribe = stopListening;
        else stopListening();
      })
      .catch((error) => {
        if (active) console.error('Unable to listen for foreground push notifications.', error);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [loadNotifications]);

  useEffect(() => {
    let active = true;
    loadAnnouncements().catch((error) => {
      if (active) setActionError(getErrorMessage(error));
    });
    loadBirthdays().catch((error) => {
      if (active) setActionError(getErrorMessage(error));
    });
    if (user?.role === 'admin') {
      Promise.all([
        apiRequest('/analytics/summary', { getIdToken, apiBaseUrl }),
        apiRequest('/analytics/leaderboard', { getIdToken, apiBaseUrl }),
      ])
        .then(([summary, leaderboard]) => {
          if (!active) return;
          setAnalytics(summary);
          setAttendanceLeaderboard(leaderboard.members || []);
        })
        .catch((error) => {
          if (active) setActionError(getErrorMessage(error));
        });
    } else if (user?.role === 'member') {
      apiRequest('/analytics/leaderboard', { getIdToken, apiBaseUrl })
        .then((leaderboard) => {
          if (active) setAttendanceLeaderboard(leaderboard.members || []);
        })
        .catch((error) => {
          if (active) setActionError(getErrorMessage(error));
        });
    }
    if (user?.role === 'member' && getDesignations(user).length > 0) {
      loadMedia().catch((error) => {
        if (active) setMediaError(getErrorMessage(error));
      });
      apiRequest('/groups/my-teams', { getIdToken, apiBaseUrl })
        .then((result) => {
          if (active) setLeadershipGroup(result);
        })
        .catch((error) => {
          if (active) {
            setGroupError(getErrorMessage(error));
          }
        });
    }
    if (isKspLeader) loadSmallGroup();
    return () => {
      active = false;
    };
  }, [
    apiBaseUrl,
    getIdToken,
    loadAnnouncements,
    loadBirthdays,
    loadMedia,
    loadSmallGroup,
    isKspLeader,
    user?.role,
    user?.secondaryDesignations,
    user?.secondaryDesignation,
  ]);

  useEffect(() => {
    let active = true;
    apiRequest('/verse-of-day', { getIdToken, apiBaseUrl })
      .then(async (metadata) => {
        const response = await fetch(
          `https://bible-api.com/${encodeURIComponent(metadata.reference)}?translation=web`
        );
        if (!response.ok) throw new Error('The Bible service is temporarily unavailable.');
        return { ...(await response.json()), metadata };
      })
      .then((result) => {
        if (active) {
          setVerse(result);
          setVerseReaction({
            reacted: result.metadata.reacted,
            reactionCount: result.metadata.reactionCount,
          });
        }
      })
      .catch((error) => {
        if (active) setVerseError(getErrorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [apiBaseUrl, getIdToken]);

  useEffect(() => {
    setProfileDraft({
      displayName: user?.name || '',
      phoneNumber: user?.phoneNumber || '',
      birthDate: user?.birthDate ? String(user.birthDate).slice(0, 10) : '',
    });
  }, [user?.birthDate, user?.name, user?.phoneNumber]);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    function dismiss(event) {
      if (event.key === 'Escape') setSettingsOpen(false);
      if (event.type === 'mousedown' && !settingsRef.current?.contains(event.target)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (!notificationsOpen) return undefined;
    function dismissNotifications(event) {
      if (event.key === 'Escape') {
        notificationsOpenRef.current = false;
        setNotificationsOpen(false);
      }
      if (
        event.type === 'mousedown' &&
        !notificationsRef.current?.contains(event.target)
      ) {
        notificationsOpenRef.current = false;
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', dismissNotifications);
    document.addEventListener('keydown', dismissNotifications);
    return () => {
      document.removeEventListener('mousedown', dismissNotifications);
      document.removeEventListener('keydown', dismissNotifications);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (welcomeSlides.length < 2) return undefined;
    const timer = window.setInterval(
      () => setWelcomeIndex((index) => (index + 1) % welcomeSlides.length),
      3000
    );
    return () => window.clearInterval(timer);
  }, [welcomeSlides.length]);

  useEffect(() => {
    let active = true;
    const requestVersion = ++bibleRequestVersion.current;
    fetch(`https://bible-api.com/John%201?translation=${encodeURIComponent(bibleTranslation)}`)
      .then((response) => {
        if (!response.ok) throw new Error('The Bible service is temporarily unavailable.');
        return response.json();
      })
      .then((result) => {
        if (active && requestVersion === bibleRequestVersion.current) setReaderVerse(result);
      })
      .catch((error) => {
        if (active && requestVersion === bibleRequestVersion.current) {
          setReaderError(getErrorMessage(error));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (announcements.length < 2) return undefined;
    const timer = window.setInterval(
      () => setSlide((current) => (current + 1) % announcements.length),
      6500
    );
    return () => window.clearInterval(timer);
  }, [announcements.length]);

  const visibleAnnouncements = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return announcements;
    return announcements.filter((announcement) =>
      `${announcement.title} ${announcement.body}`.toLowerCase().includes(term)
    );
  }, [announcements, search]);

  const heroAnnouncement = announcements[slide % Math.max(announcements.length, 1)];
  const profileName = user?.name || 'Church member';
  const photo = user?.profilePicture;
  const designationText = getDesignations(user).join(', ');
  const isLeader = user?.role === 'member' && hasLeadershipDesignation(user);
  const hasDesignatedTeam =
    user?.role === 'member' && getDesignations(user).length > 0;
  const canAddGroupMembers =
    user?.role === 'member' && hasLeadershipDesignation(user);
  const canViewReports =
    user?.role === 'admin';
  const canViewLeaderboard = ['admin', 'member'].includes(user?.role);
  const selectedBook = BIBLE_BOOKS.find(([book]) => book === readerBook) || BIBLE_BOOKS[0];

  async function loadBibleReference(reference, translation = bibleTranslation) {
    const requestVersion = ++bibleRequestVersion.current;
    setReaderLoading(true);
    setReaderError('');
    setReaderVerse(null);
    try {
      if (Object.hasOwn(API_BIBLE_TRANSLATIONS, translation)) {
        const result = await fetchApiBibleReference(reference, translation);
        if (requestVersion !== bibleRequestVersion.current) return;
        setReaderVerse(result);
        return;
      }
      const response = await fetch(
        `https://bible-api.com/${encodeURIComponent(reference)}?translation=${encodeURIComponent(translation)}`
      );
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || 'That Bible passage could not be found.');
      }
      if (requestVersion !== bibleRequestVersion.current) return;
      setReaderVerse(result);
      const matched = BIBLE_BOOKS.find(([book]) =>
        result.reference?.toLowerCase().startsWith(book.toLowerCase())
      );
      if (matched) {
        setReaderBook(matched[0]);
        const chapter = Number(result.reference.match(/\s(\d+)(?::|$)/)?.[1]);
        if (Number.isInteger(chapter) && chapter > 0) setReaderChapter(chapter);
      }
    } catch (error) {
      if (requestVersion === bibleRequestVersion.current) {
        setReaderError(getErrorMessage(error));
      }
    } finally {
      if (requestVersion === bibleRequestVersion.current) setReaderLoading(false);
    }
  }

  async function removeTeamMember(team, member) {
    const removalKey = `${team.id}:${member.id}`;
    setTeamMemberRemoving(removalKey);
    setGroupMemberError('');
    setGroupMemberMessage('');
    try {
      const result = await apiRequest(
        `/groups/team-members/${encodeURIComponent(team.id)}/${encodeURIComponent(member.id)}`,
        { getIdToken, apiBaseUrl, method: 'DELETE' }
      );
      setLeadershipGroup((current) => current && ({
        ...current,
        teams: current.teams.map((item) =>
          String(item.id) === String(team.id)
            ? {
                ...item,
                members: item.members.filter(
                  (currentMember) => String(currentMember.id) !== String(member.id)
                ),
              }
            : item
        ),
      }));
      setGroupMemberMessage(result.message);
    } catch (error) {
      setGroupMemberError(getErrorMessage(error));
    } finally {
      setTeamMemberRemoving('');
    }
  }

  async function removeSmallGroupMember(member) {
    setSmallGroupMemberRemoving(String(member.id));
    setSmallGroupError('');
    setSmallGroupMessage('');
    try {
      const result = await apiRequest(
        `/groups/members/${encodeURIComponent(member.id)}`,
        { getIdToken, apiBaseUrl, method: 'DELETE' }
      );
      setSmallGroup((current) => current && ({
        ...current,
        members: current.members.filter(
          (currentMember) => String(currentMember.id) !== String(member.id)
        ),
      }));
      setSmallGroupMessage(result.message);
    } catch (error) {
      setSmallGroupError(getErrorMessage(error));
    } finally {
      setSmallGroupMemberRemoving('');
    }
  }

  function requestTeamMemberRemoval(team, member) {
    setConfirmation({
      title: `Remove ${member.name} from the ${team.name} team?`,
      message: 'Their account and other assignments will remain unchanged.',
      confirmText: 'Remove',
      onConfirm: () => removeTeamMember(team, member),
    });
  }

  function requestSmallGroupMemberRemoval(member) {
    setConfirmation({
      title: `Remove ${member.name} from ${smallGroup.group.name}?`,
      message: 'Their account will remain active, but their small-group assignment and QR attendance access will be removed.',
      confirmText: 'Remove',
      onConfirm: () => removeSmallGroupMember(member),
    });
  }

  async function submitBibleSearch(event) {
    event.preventDefault();
    const reference = readerReference.trim();
    if (!reference) {
      setReaderError('Enter a Bible reference, such as John 3:16 or Psalm 23.');
      return;
    }
    await loadBibleReference(reference);
  }

  async function loadBibleChapter(book, chapter, translation = bibleTranslation) {
    setReaderBook(book);
    setReaderChapter(chapter);
    setReaderReference('');
    await loadBibleReference(`${book} ${chapter}`, translation);
  }

  async function toggleVerseReaction() {
    try {
      const result = await apiRequest('/verse-of-day/reactions', {
        getIdToken,
        apiBaseUrl,
        method: 'POST',
      });
      setVerseReaction(result);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function toggleNotifications() {
    if (notificationsOpen) {
      closeNotifications();
      return;
    }
    notificationsOpenRef.current = true;
    setNotificationsOpen(true);
    try {
      const result = await apiRequest('/notifications', { getIdToken, apiBaseUrl });
      setNotifications(result.notifications || []);
      setUnreadNotificationCount(result.unreadCount || 0);
      await apiRequest('/notifications/read-all', {
        getIdToken,
        apiBaseUrl,
        method: 'PATCH',
      });
      setNotifications((items) =>
        items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))
      );
      setUnreadNotificationCount(0);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  function closeNotifications() {
    notificationsOpenRef.current = false;
    setNotificationsOpen(false);
  }

  async function markNotificationRead(notificationId) {
    try {
      const result = await apiRequest(`/notifications/${notificationId}/read`, {
        getIdToken,
        apiBaseUrl,
        method: 'PATCH',
      });
      setNotifications((items) =>
        items.map((item) =>
          String(item._id) === String(notificationId)
            ? { ...item, readAt: item.readAt || new Date().toISOString() }
            : item
        )
      );
      setUnreadNotificationCount(result.unreadCount || 0);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function togglePushNotifications() {
    if (!user?._id) return;
    setPushBusy(true);
    setPushError('');
    try {
      if (pushEnabled) {
        await removePushNotifications(user._id, getIdToken, apiBaseUrl);
        setPushEnabled(false);
      } else {
        await registerPushNotifications(user._id, getIdToken, apiBaseUrl);
        setPushEnabled(true);
      }
    } catch (error) {
      setPushError(getErrorMessage(error));
    } finally {
      setPushBusy(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileError('');
    setProfileNotice('');
    try {
      await apiRequest('/auth/profile', {
        getIdToken,
        apiBaseUrl,
        method: 'PATCH',
        body: JSON.stringify({
          displayName: profileDraft.displayName.trim(),
          phoneNumber: profileDraft.phoneNumber.trim(),
          birthDate: profileDraft.birthDate || null,
        }),
      });
      await refreshProfile();
      setProfileNotice('Your profile was updated.');
    } catch (error) {
      setProfileError(getErrorMessage(error));
    } finally {
      setProfileBusy(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setProfileError('');
    setProfileNotice('');
    const isSettingPassword =
      !firebaseUser?.providerData.some(({ providerId }) => providerId === 'password');
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setProfileError('Your new password and confirmation do not match.');
      return;
    }

    setPasswordBusy(true);
    try {
      if (firebaseUser?.providerData.some(({ providerId }) => providerId === 'password')) {
        await changePassword(passwordDraft.currentPassword, passwordDraft.newPassword);
      } else {
        await setPassword(passwordDraft.newPassword);
      }
      setPasswordDraft({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setProfileNotice(
        isSettingPassword
          ? 'Your password was set. You can now sign in with your email and password.'
          : 'Your password was updated.'
      );
    } catch (error) {
      const messages = {
        'auth/invalid-credential': 'Your current password is incorrect.',
        'auth/wrong-password': 'Your current password is incorrect.',
        'auth/requires-recent-login': 'Please sign in again before changing your password.',
        'auth/weak-password': 'Choose a stronger password with at least 8 characters.',
        'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
      };
      setProfileError(messages[error?.code] || getErrorMessage(error));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function addGroupMember(event) {
    event.preventDefault();
    setGroupMemberBusy(true);
    setGroupMemberError('');
    setGroupMemberMessage('');
    try {
      const formData = new FormData(event.currentTarget);
      const result = await apiRequest('/groups/team-members', {
        getIdToken,
        apiBaseUrl,
        method: 'POST',
        body: JSON.stringify({
          teamId: formData.get('teamId'),
          userId: formData.get('userId'),
        }),
      });
      const updatedGroup = await apiRequest('/groups/my-teams', {
        getIdToken,
        apiBaseUrl,
      });
      setLeadershipGroup(updatedGroup);
      setSelectedTeamMembers((current) => ({
        ...current,
        [formData.get('teamId')]: '',
      }));
      setGroupMemberMessage(result.message);
    } catch (error) {
      setGroupMemberError(getErrorMessage(error));
    } finally {
      setGroupMemberBusy(false);
    }
  }

  async function signOutFromMenu() {
    setSettingsOpen(false);
    if (pushEnabled) {
      try {
        await removePushNotifications(user._id, getIdToken, apiBaseUrl);
      } catch (error) {
        setActionError(`Could not disable this device's push token before sign-out: ${getErrorMessage(error)}`);
        return;
      }
    }
    await logout();
  }

  async function toggleReaction(type, id) {
    setActionError('');
    try {
      await apiRequest(
        type === 'announcement'
          ? `/announcements/${id}/reactions`
          : `/birthdays/${id}/reactions`,
        { getIdToken, apiBaseUrl, method: 'POST' }
      );
      if (type === 'announcement') await loadAnnouncements();
      else await loadBirthdays();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function toggleCommentReaction(type, entityId, commentId) {
    setActionError('');
    try {
      const path = type === 'announcement'
        ? `/announcements/${entityId}/comments/${commentId}/reactions`
        : `/birthdays/${entityId}/comments/${commentId}/reactions`;
      const result = await apiRequest(path, {
        getIdToken,
        apiBaseUrl,
        method: 'POST',
      });
      const updateComment = (comment) =>
        String(comment._id) === String(commentId)
          ? {
              ...comment,
              reactions: result.reacted
                ? [...(comment.reactions || []).filter((id) => String(id._id || id) !== String(user?._id)), user?._id]
                : (comment.reactions || []).filter((id) => String(id._id || id) !== String(user?._id)),
            }
          : comment;
      if (type === 'announcement') {
        setAnnouncements((items) =>
          items.map((item) =>
            String(item._id || item.id) === String(entityId)
              ? { ...item, comments: (item.comments || []).map(updateComment) }
              : item
          )
        );
      } else {
        setBirthdays((items) =>
          items.map((item) =>
            String(item.id) === String(entityId)
              ? { ...item, comments: (item.comments || []).map(updateComment) }
              : item
          )
        );
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function addComment(type, id) {
    const key = `${type}-${id}`;
    const body = (commentDrafts[key] || '').trim();
    if (!body) return;
    setActionError('');
    try {
      const result = await apiRequest(
        type === 'announcement'
          ? `/announcements/${id}/comments`
          : `/birthdays/${id}/comments`,
        {
          getIdToken,
          apiBaseUrl,
          method: 'POST',
          body: JSON.stringify({ body }),
        }
      );
      setCommentDrafts((drafts) => ({ ...drafts, [key]: '' }));
      if (type === 'announcement') await loadAnnouncements();
      else {
        setBirthdays((current) =>
          current.map((birthday) =>
            String(birthday.id) === String(id)
              ? { ...birthday, comments: [...birthday.comments, result.comment] }
              : birthday
          )
        );
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function uploadMedia(event) {
    event.preventDefault();
    if (!mediaFile) {
      setMediaError('Choose a file before uploading.');
      return;
    }
    setMediaBusy(true);
    setMediaError('');
    setMediaNotice('');
    try {
      const formData = new FormData();
      formData.append('file', mediaFile);
      await apiRequest('/upload/ministry-media', {
        getIdToken,
        apiBaseUrl,
        method: 'POST',
        body: formData,
      });
      setMediaFile(null);
      setMediaNotice('Your ministry media was uploaded.');
      await loadMedia();
    } catch (error) {
      setMediaError(getErrorMessage(error));
    } finally {
      setMediaBusy(false);
    }
  }

  async function publishAdminAnnouncement(event) {
    event.preventDefault();
    setActionError('');
    try {
      await apiRequest('/announcements', {
        getIdToken,
        apiBaseUrl,
        method: 'POST',
        body: JSON.stringify({
          title: announcementDraft.title.trim(),
          body: announcementDraft.body.trim(),
          status: 'published',
        }),
      });
      setAnnouncementDraft({ title: '', body: '' });
      await loadAnnouncements();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  const profileCompletionFields = [
    user?.name,
    user?.email,
    user?.profilePicture,
    user?.groupName || designationText,
  ];
  const profileCompletion = Math.round(
    (profileCompletionFields.filter(Boolean).length / profileCompletionFields.length) * 100
  );

  return (
    <main className="church-dashboard-shell min-h-screen bg-[#f7f8fc] text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1800px] grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[218px_minmax(0,1fr)_286px]">
        <aside className="sticky top-0 hidden h-screen self-start flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-5 md:flex xl:px-5">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
            <img src="/images/logo/Logo.jpg" alt="The Life Builder Church" className="h-10 w-10 rounded-full object-cover" />
          </Link>
          <p className="mb-3 mt-9 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Overview</p>
          <nav className="space-y-1">
            {[
              ...navItems.filter((item) => item.label !== 'Tasks' || isLeader),
              ...(user?.role === 'admin' ? [{ label: 'User management', href: '#user-management', icon: '♙' }] : []),
              ...(isKspLeader ? [{ label: 'Attendance', href: '#attendance-monitoring', icon: '✓' }] : []),
              ...(canViewReports ? [{ label: 'Reports', href: '#reports', icon: '▥' }] : []),
              ...(user?.role === 'admin' ? [{ label: 'Welcome slides', href: '#slideshow-management', icon: '▧' }] : []),
            ].map((item, index) => (
              <a
                key={item.label}
                href={item.href}
                className={`flex items-center gap-2 rounded-xl px-2 py-2.5 text-xs font-semibold transition xl:gap-3 xl:px-3 xl:text-sm ${
                  index === 0
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="w-5 text-center text-base">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>
          <p className="mb-3 mt-8 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">My community</p>
          <div className="space-y-3">
            <a href="#groups" className="flex items-center gap-3 rounded-lg text-xs text-slate-600 hover:text-violet-700">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-100">♧</span>
              <span><b className="block font-semibold text-slate-700">Small groups</b>Grow together</span>
            </a>
            <a href="#ministry-media" className="flex items-center gap-3 rounded-lg text-xs text-slate-600 hover:text-violet-700">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-sky-100">♫</span>
              <span><b className="block font-semibold text-slate-700">Ministry teams</b>{designationText || 'Find your place'}</span>
            </a>
          </div>
        </aside>

        <section id="dashboard" className="min-w-0 px-3 py-3 sm:px-7 sm:py-4 lg:px-8">
          <header className="mb-5 flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((open) => !open)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:hidden"
            >
              <span aria-hidden="true" className="text-xl">{mobileNavOpen ? '×' : '☰'}</span>
            </button>
            <label className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search announcements…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
            </label>
            {canAddGroupMembers && (
              <Link
                to="/scanner"
                aria-label="Open QR attendance scanner"
                title="QR attendance scanner"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18v2M18 18h2v2h-2z" />
                </svg>
              </Link>
            )}
            <div ref={notificationsRef} className="relative shrink-0">
              <button
                type="button"
                aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}
                aria-expanded={notificationsOpen}
                onClick={toggleNotifications}
                className="relative grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className={`h-5 w-5 ${unreadNotificationCount > 0 ? 'animate-mail-ring' : ''}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5h16v13H4zM4.5 6l7.5 6 7.5-6" />
                </svg>
                {unreadNotificationCount > 0 && (
                  <span
                    aria-live="polite"
                    className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-900"
                  >
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>
              <section
                aria-label="Notifications"
                aria-hidden={!notificationsOpen}
                inert={!notificationsOpen}
                className={`absolute right-0 top-12 z-30 w-[min(90vw,360px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-in-out motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 ${
                  notificationsOpen
                    ? 'translate-y-0 scale-100 opacity-100'
                    : 'pointer-events-none -translate-y-2 scale-95 opacity-0'
                }`}
              >
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Notifications</h2>
                      <p className="text-[11px] text-slate-500">
                        {unreadNotificationCount ? `${unreadNotificationCount} unread` : 'You’re all caught up'}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Close notifications"
                      onClick={closeNotifications}
                      className="grid h-9 w-9 place-items-center rounded-full text-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      ×
                    </button>
                  </div>
                  <div className="max-h-[min(55vh,420px)] overflow-y-auto overscroll-contain">
                    {notifications.length ? notifications.map((notification) => (
                      <a
                        key={notification._id}
                        href={notification.scope === 'birthday' ? '#birthday-celebrants' : '#announcements'}
                        onClick={() => {
                          closeNotifications();
                          if (!notification.readAt) markNotificationRead(notification._id);
                        }}
                        className={`block border-b border-slate-100 px-4 py-3 text-left transition hover:bg-violet-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                          notification.readAt ? '' : 'bg-violet-50/60 dark:bg-violet-900/20'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!notification.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-600" />}
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">{notification.title}</span>
                            <span className="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-300">{notification.message}</span>
                            <span className="mt-1 block text-[10px] text-slate-400">
                              {new Date(notification.createdAt).toLocaleString()}
                            </span>
                          </span>
                        </div>
                      </a>
                    )) : (
                      <p className="px-4 py-6 text-center text-xs text-slate-500">No notifications yet.</p>
                    )}
                  </div>
                  <div className="border-t border-slate-100 p-3 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={togglePushNotifications}
                      disabled={pushBusy}
                      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-violet-50 px-3 text-xs font-semibold text-violet-800 transition hover:bg-violet-100 disabled:opacity-50 dark:bg-slate-800 dark:text-violet-200 dark:hover:bg-slate-700"
                    >
                      {pushBusy ? 'Updating…' : pushEnabled ? 'Disable push alerts on this device' : 'Enable push alerts on this device'}
                    </button>
                    {pushError && <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">{pushError}</p>}
                  </div>
              </section>
            </div>
            <div ref={settingsRef} className="relative shrink-0">
              <button
                type="button"
                aria-label={settingsOpen ? 'Close settings menu' : 'Open settings menu'}
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((open) => !open)}
                className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
                </svg>
              </button>
              <div
                aria-hidden={!settingsOpen}
                inert={!settingsOpen}
                className={`absolute right-0 top-12 z-30 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl transition-all duration-300 ease-in-out motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 ${
                  settingsOpen
                    ? 'translate-y-0 scale-100 opacity-100'
                    : 'pointer-events-none -translate-y-2 scale-95 opacity-0'
                }`}
              >
                  <button
                    type="button"
                    onClick={() => { setSettingsOpen(false); setProfileOpen(true); setProfileError(''); setProfileNotice(''); }}
                    className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-slate-700 transition hover:bg-violet-50 hover:text-violet-800"
                  >
                    <span aria-hidden="true">♙</span> Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSettingsOpen(false); setQrOpen(true); }}
                    className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-slate-700 transition hover:bg-violet-50 hover:text-violet-800"
                  >
                    <span aria-hidden="true">▦</span> QR ID
                  </button>
                  <ThemeToggle />
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={signOutFromMenu}
                    className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-orange-600 transition hover:bg-orange-50"
                  >
                    <span aria-hidden="true">⇥</span> Log Out
                  </button>
              </div>
            </div>
          </header>

          <div
            aria-hidden={!mobileNavOpen}
            className={`fixed inset-0 z-40 transition-opacity duration-300 ease-in-out motion-reduce:transition-none md:hidden ${
              mobileNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
              <button
                type="button"
                aria-label="Close navigation menu"
                className="absolute inset-0 h-full w-full bg-slate-950/50"
                onClick={() => setMobileNavOpen(false)}
              />
              <nav
                aria-label="Mobile dashboard navigation"
                inert={!mobileNavOpen}
                className={`absolute inset-y-0 left-0 flex w-[min(84vw,340px)] flex-col overflow-y-auto border-r border-slate-200 bg-white p-5 shadow-2xl transition-transform duration-300 ease-in-out motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 ${
                  mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
              >
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">TLBC menu</span>
                  <button type="button" aria-label="Close navigation menu" className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 text-xl text-slate-600 dark:border-slate-700 dark:text-slate-200" onClick={() => setMobileNavOpen(false)}>×</button>
                </div>
                <div className="space-y-1">
                  {[
                    ...navItems.filter((item) => item.label !== 'Tasks' || isLeader),
                    ...(user?.role === 'admin' ? [{ label: 'User management', href: '#user-management', icon: '♙' }] : []),
                    ...(isKspLeader ? [{ label: 'Attendance', href: '#attendance-monitoring', icon: '✓' }] : []),
                    ...(canViewReports ? [{ label: 'Reports', href: '#reports', icon: '▥' }] : []),
                    ...(user?.role === 'admin' ? [{ label: 'Welcome slides', href: '#slideshow-management', icon: '▧' }] : []),
                  ].map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-700 transition hover:bg-violet-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <span className="w-6 text-center text-lg">{item.icon}</span>
                      {item.label}
                    </a>
                  ))}
                </div>
                <div className="my-5 border-t border-slate-200 dark:border-slate-700" />
                <ThemeToggle />
                <a href="#groups" onClick={() => setMobileNavOpen(false)} className="mt-2 flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-violet-50 dark:text-slate-200 dark:hover:bg-slate-800">♧ Small groups</a>
                <a href="#ministry-media" onClick={() => setMobileNavOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-violet-50 dark:text-slate-200 dark:hover:bg-slate-800">♫ Ministry teams</a>
              </nav>
          </div>

          <section className="relative mb-4 min-h-[150px] overflow-hidden rounded-2xl bg-gradient-to-r from-[#5e55dc] via-[#7162e8] to-[#7862e3] px-6 py-6 text-white shadow-sm sm:px-8">
            {heroAnnouncement?.banner?.url && (
              <img src={heroAnnouncement.banner.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
            )}
            <div className="absolute -right-3 -top-10 h-48 w-48 rounded-full border-[18px] border-white/10" />
            <div className="relative max-w-xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100">
                {heroAnnouncement ? 'Church highlight' : 'The Life Builder Church'}
              </p>
              <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-[28px]">
                {heroAnnouncement?.title || `Welcome, ${profileName.split(' ')[0]}`}
              </h1>
              <p className="mt-2 line-clamp-2 text-sm text-white/85">
                {heroAnnouncement?.body || 'A place to grow in faith, build community, and serve together.'}
              </p>
            </div>
            {announcements.length > 1 && (
              <div className="absolute bottom-4 right-5 flex gap-2">
                {announcements.slice(0, 5).map((announcement, index) => (
                  <button
                    key={announcement._id}
                    type="button"
                    aria-label={`Show highlight ${index + 1}`}
                    onClick={() => setSlide(index)}
                    className="grid h-11 w-11 place-items-center rounded-full"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${index === slide ? 'bg-white' : 'bg-white/40'}`} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section
            aria-label="Church welcome slideshow"
            className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex min-h-40 items-center justify-center bg-slate-950">
              <img
                key={welcomeSlides[welcomeIndex]?.id}
                src={welcomeSlides[welcomeIndex]?.src}
                alt={welcomeSlides[welcomeIndex]?.title || 'Church welcome'}
                className="welcome-slideshow-image block h-auto max-h-[min(60vh,520px)] w-full object-contain"
              />
            </div>
            <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
                  Welcome to The Life Builder Church · {welcomeIndex + 1} of {welcomeSlides.length}
                </p>
                <h2 className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                  {welcomeSlides[welcomeIndex]?.title}
                </h2>
                {welcomeSlides[welcomeIndex]?.caption && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                    {welcomeSlides[welcomeIndex].caption}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                Slide {welcomeIndex + 1} of {welcomeSlides.length}
              </p>
            </div>
          </section>

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'My community', value: user?.groupName || designationText || 'Church family', color: 'bg-violet-100 text-violet-700', icon: '♧', href: '#groups' },
              { label: 'Church updates', value: `${announcements.length} announcement${announcements.length === 1 ? '' : 's'}`, color: 'bg-pink-100 text-pink-700', icon: '✦', href: '#announcements' },
              { label: 'This month', value: `${birthdays.length} birthday${birthdays.length === 1 ? '' : 's'}`, color: 'bg-sky-100 text-sky-700', icon: '🎂', href: '#birthday-celebrants' },
            ].map((metric) => (
              <a href={metric.href} key={metric.label} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-violet-200 hover:bg-violet-50/50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-200">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${metric.color}`}>{metric.icon}</span>
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400">{metric.label}</p>
                  <p className="truncate text-sm font-bold text-slate-800">{metric.value}</p>
                </div>
              </a>
            ))}
          </div>

          {canViewLeaderboard && (
            <Link
              to="/leaderboards"
              aria-label="View full attendance leaderboard"
              className="mb-6 block rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-300 dark:border-slate-700 dark:bg-slate-900 xl:hidden"
            >
              <span className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Attendance leaderboard</span>
                <span className="text-[10px] text-slate-400">View all →</span>
              </span>
              {attendanceLeaderboard.length ? (
                <span className="mt-3 grid grid-cols-3 gap-2">
                  {attendanceLeaderboard.slice(0, 3).map((member, index) => (
                    <span
                      key={member.memberId}
                      className="min-w-0 rounded-lg bg-slate-50 p-2 text-center dark:bg-slate-800"
                    >
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                        {member.presentCount} Present
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {index + 1}. {member.memberName}
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="mt-3 block rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  No ranked members yet. Open the full leaderboard for details.
                </span>
              )}
            </Link>
          )}

          <section id="announcements" className="mb-6">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Stay connected</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Church announcements</h2>
              </div>
              <span className="text-xs text-slate-400">Latest updates</span>
            </div>
            {visibleAnnouncements.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {visibleAnnouncements.slice(0, 4).map((announcement) => {
                  const id = announcement._id || announcement.id;
                  return (
                    <article key={id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                      {announcement.banner?.url && <img src={announcement.banner.url} alt="" className="h-32 w-full object-cover" />}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-bold text-slate-900">{announcement.title}</h3>
                          <span className="shrink-0 rounded-full bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">Church update</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-600">{announcement.body}</p>
                        <p className="mt-2 text-[11px] text-slate-400">
                          {announcement.author?.displayName || 'Church team'}
                          {announcement.publishedAt ? ` · ${new Date(announcement.publishedAt).toLocaleDateString()}` : ''}
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleReaction('announcement', id)}
                            aria-pressed={isReacted(announcement.reactions, user?._id)}
                            className={`text-xs font-semibold ${isReacted(announcement.reactions, user?._id) ? 'text-violet-700' : 'text-slate-500 hover:text-violet-700'}`}
                          >
                            ♥ {announcement.reactions?.length || 0}
                          </button>
                          <span className="text-xs text-slate-400">{announcement.comments?.length || 0} comments</span>
                        </div>
                        {announcement.comments?.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                            {announcement.comments.slice(-2).map((comment) => (
                              <div key={comment._id} className="flex items-start gap-2 text-xs">
                                <p className="min-w-0 flex-1 text-slate-600 dark:text-slate-300">
                                  <b>{comment.user?.displayName || 'Member'}:</b> {comment.body}
                                </p>
                                <button
                                  type="button"
                                  aria-label={`React to ${comment.user?.displayName || 'member'}'s comment`}
                                  aria-pressed={isReacted(comment.reactions, user?._id)}
                                  onClick={() => toggleCommentReaction('announcement', id, comment._id)}
                                  className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 transition ${
                                    isReacted(comment.reactions, user?._id)
                                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
                                      : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30'
                                  }`}
                                >
                                  <span aria-hidden="true">♥</span>
                                  {comment.reactions?.length || 0}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <form
                          className="mt-3 flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            addComment('announcement', id);
                          }}
                        >
                          <input
                            value={commentDrafts[`announcement-${id}`] || ''}
                            onChange={(event) =>
                              setCommentDrafts((drafts) => ({
                                ...drafts,
                                [`announcement-${id}`]: event.target.value,
                              }))
                            }
                            maxLength={1000}
                            aria-label="Add a comment"
                            placeholder="Write a comment…"
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-violet-300"
                          />
                          <button className="rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700">Send</button>
                        </form>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-500">No announcements match your search.</p>
            )}
          </section>

          {user?.role === 'admin' && (
            <section className="mb-6 rounded-2xl border border-violet-100 bg-violet-50/60 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Admin tools</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Publish a church announcement</h2>
              <form className="mt-3 space-y-3" onSubmit={publishAdminAnnouncement}>
                <input
                  required
                  maxLength={160}
                  value={announcementDraft.title}
                  onChange={(event) => setAnnouncementDraft((draft) => ({ ...draft, title: event.target.value }))}
                  placeholder="Announcement title"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-300"
                />
                <textarea
                  required
                  maxLength={10000}
                  rows={3}
                  value={announcementDraft.body}
                  onChange={(event) => setAnnouncementDraft((draft) => ({ ...draft, body: event.target.value }))}
                  placeholder="Share an update with the church…"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-300"
                />
                <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">Publish announcement</button>
              </form>
            </section>
          )}

          <VerseOfDayCard
            id="verse-of-day-mobile"
            className="mb-6 xl:hidden"
            verse={verse}
            verseError={verseError}
            verseReaction={verseReaction}
            onToggleReaction={toggleVerseReaction}
          />

          <section id="bible-reader" className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Digital Bible</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Read the Word</h2>
              </div>
              <form className="flex w-full gap-2 sm:max-w-sm" onSubmit={submitBibleSearch}>
                <input
                  value={readerReference}
                  onChange={(event) => setReaderReference(event.target.value)}
                  placeholder="Search a passage, e.g. John 3:16"
                  aria-label="Bible passage reference"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-300"
                />
                <button className="rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700" disabled={readerLoading}>
                  {readerLoading ? '…' : 'Search'}
                </button>
              </form>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3">
              <label className="min-w-[12rem] flex-1 text-xs font-semibold text-slate-600">
                Book
                <select
                  value={readerBook}
                  onChange={(event) => {
                    const nextBook = event.target.value;
                    setReaderBook(nextBook);
                    setReaderChapter(1);
                    loadBibleChapter(nextBook, 1);
                  }}
                  className="mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-300"
                >
                  {BIBLE_BOOKS.map(([book]) => <option key={book}>{book}</option>)}
                </select>
              </label>
              <label className="w-28 text-xs font-semibold text-slate-600">
                Chapter
                <select
                  value={readerChapter}
                  onChange={(event) => loadBibleChapter(readerBook, Number(event.target.value))}
                  className="mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-300"
                >
                  {Array.from({ length: selectedBook[1] }, (_, index) => index + 1).map((chapter) => (
                    <option key={chapter} value={chapter}>{chapter}</option>
                  ))}
                </select>
              </label>
              <label className="min-w-[12rem] flex-1 text-xs font-semibold text-slate-600">
                Bible version
                <select
                  value={bibleTranslation}
                  onChange={(event) => {
                    const translation = event.target.value;
                    setBibleTranslation(translation);
                    loadBibleReference(
                      readerVerse?.reference || `${readerBook} ${readerChapter}`,
                      translation
                    );
                  }}
                  className="mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-300"
                >
                  {BIBLE_TRANSLATIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={readerLoading || readerChapter <= 1}
                onClick={() => loadBibleChapter(readerBook, readerChapter - 1)}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-violet-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={readerLoading || readerChapter >= selectedBook[1]}
                onClick={() => loadBibleChapter(readerBook, readerChapter + 1)}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-violet-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
            {readerError && <p role="alert" className="mt-3 text-sm text-red-700">{readerError}</p>}
            {readerVerse && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-100 bg-white">
                <div className="flex items-center justify-between bg-violet-50 px-4 py-3">
                  <p className="font-bold text-violet-900">{readerVerse.reference}</p>
                  <p className="text-[10px] text-slate-500">{readerVerse.translation_name}</p>
                </div>
                {readerVerse.verses?.length ? (
                  <div className="max-h-[28rem] space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
                    {readerVerse.verses.map((item) => (
                      <p key={`${readerVerse.reference}-${item.verse}`} className="font-serif text-[15px] leading-7 text-slate-700">
                        <sup className="mr-1.5 font-sans text-[10px] font-bold text-violet-600">{item.verse}</sup>
                        {item.text.trim()}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap px-4 py-4 font-serif text-[15px] leading-7 text-slate-700">{readerVerse.text?.trim()}</p>
                )}
              </div>
            )}
          </section>

          {isLeader && (
            <section id="ministry-media" className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">For ministry leaders</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Event & Sunday media</h2>
                <p className="mt-1 text-sm text-slate-500">Share images, graphics, and documents with the church team.</p>
              </div>
              <form onSubmit={uploadMedia} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv"
                  onChange={(event) => setMediaFile(event.target.files?.[0] || null)}
                  className="min-w-0 flex-1 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:font-semibold file:text-violet-700"
                  disabled={mediaBusy}
                />
                <button disabled={mediaBusy} className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {mediaBusy ? 'Uploading…' : 'Upload file'}
                </button>
              </form>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {media.slice(0, 6).map((item) => (
                  <a key={item._id} href={item.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 hover:bg-violet-50">
                    <span className="truncate">{item.name}</span>
                    <span className="shrink-0 text-slate-400">{item.uploadedBy?.displayName || 'Member'}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          <section id="groups" className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Your community</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Small groups & ministry</h2>
            <p className="mt-2 text-sm text-slate-600">
              {user?.groupName
                ? `You are connected with ${user.groupName}.`
                : designationText
                  ? `You serve as ${designationText}.`
                  : 'Stay connected with your small group and find a way to serve.'}
            </p>
          </section>

          {hasDesignatedTeam && leadershipGroup && (
            <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Leader tools</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">Your ministry teams</h2>
                </div>
                <span className="text-xs text-slate-500">{leadershipGroup.teams.length} team{leadershipGroup.teams.length === 1 ? '' : 's'}</span>
              </div>

              <div className="mt-3 space-y-2">
                {leadershipGroup.teams.map((team) => (
                  <details key={team.id} className="rounded-xl border border-slate-200">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                      <span>{team.name} <span className="font-normal text-slate-500">· {team.members.length} members</span></span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">{team.designations.join(', ')}</span>
                    </summary>
                    <div className="border-t border-slate-100 p-3">
                      <div className="max-h-64 overflow-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="sticky top-0 border-b border-slate-100 bg-white text-[10px] uppercase tracking-wide text-slate-400">
                            <tr>
                              <th className="py-2 pr-4">Member</th>
                              <th className="py-2 pr-4">Email</th>
                              <th className="py-2">Designations</th>
                              {team.canManage && <th className="py-2 pl-3">Action</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {team.members.map((member) => (
                              <tr key={member.id}>
                                <td className="py-2 pr-4 font-medium text-slate-700">{member.name}</td>
                                <td className="py-2 pr-4 text-slate-500">{member.email}</td>
                                <td className="py-2 text-slate-500">{getDesignations(member).join(', ') || 'Member'}</td>
                                {team.canManage && (
                                  <td className="py-2 pl-3">
                                    {String(member.id) === String(user?._id) ? (
                                      <span className="text-xs text-slate-400">You</span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => requestTeamMemberRemoval(team, member)}
                                        disabled={teamMemberRemoving !== ''}
                                        className="min-h-9 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                      >
                                        {teamMemberRemoving === `${team.id}:${member.id}` ? 'Removing…' : 'Remove'}
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {canAddGroupMembers && team.canManage && (
                        <form onSubmit={addGroupMember} className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
                          <input type="hidden" name="teamId" value={team.id} />
                          <label className="min-w-0 flex-1 text-xs font-semibold text-slate-700">
                            Add an active member
                            <select
                              required
                              name="userId"
                              value={selectedTeamMembers[team.id] || ''}
                              onChange={(event) =>
                                setSelectedTeamMembers((current) => ({
                                  ...current,
                                  [team.id]: event.target.value,
                                }))
                              }
                              className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-400"
                            >
                              <option value="">Select a member</option>
                              {leadershipGroup.availableMembers.map((member) => (
                                <option
                                  key={member.id}
                                  value={member.id}
                                  disabled={team.members.some((item) => item.id === member.id)}
                                >
                                  {member.name} · {member.email}
                                  {team.members.some((item) => item.id === member.id) ? ' (already assigned)' : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="submit"
                            disabled={groupMemberBusy || !selectedTeamMembers[team.id]}
                            className="min-h-10 self-end rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                          >
                            {groupMemberBusy ? 'Adding…' : 'Add to team'}
                          </button>
                        </form>
                      )}
                    </div>
                  </details>
                ))}
              </div>

              <details className="mt-3 rounded-xl border border-slate-200">
                <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                  Browse all active members ({leadershipGroup.availableMembers.length})
                </summary>
                <div className="max-h-80 overflow-auto border-t border-slate-100 px-3">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 border-b border-slate-100 bg-white text-[10px] uppercase tracking-wide text-slate-400">
                      <tr><th className="py-2 pr-4">Member</th><th className="py-2 pr-4">Email</th><th className="py-2">Designations</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {leadershipGroup.availableMembers.map((member) => (
                        <tr key={member.id}>
                          <td className="py-2 pr-4 font-medium text-slate-700">{member.name}</td>
                          <td className="py-2 pr-4 text-slate-500">{member.email}</td>
                          <td className="py-2 text-slate-500">{getDesignations(member).join(', ') || 'Member'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              {groupMemberError && <p role="alert" className="mt-2 text-sm text-red-700">{groupMemberError}</p>}
              {groupMemberMessage && <p role="status" className="mt-2 text-sm text-emerald-700">{groupMemberMessage}</p>}
            </section>
          )}
          {isKspLeader && (
            <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Leader tools</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Your small group</h2>
                <p className="mt-1 text-sm text-slate-500">Remove members who are no longer assigned to your group. Their account remains active.</p>
              </div>
              {smallGroupLoading ? (
                <p role="status" className="py-4 text-center text-sm text-slate-500">Loading group members…</p>
              ) : smallGroupError ? (
                <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{smallGroupError}</p>
              ) : smallGroup ? (
                <>
                  <p className="mb-3 text-sm font-semibold text-slate-700">{smallGroup.group.name}</p>
                  {smallGroup.members.length ? (
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {smallGroup.members.map((member) => (
                        <li key={member.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-slate-800">{member.name}</p>
                            <p className="text-xs text-slate-500">{getDesignations(member).join(', ') || 'Member'}</p>
                          </div>
                          {String(member.id) === String(user?._id) ? (
                            <span className="text-xs text-slate-400">You</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => requestSmallGroupMemberRemoval(member)}
                              disabled={smallGroupMemberRemoving !== ''}
                              className="min-h-9 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              {smallGroupMemberRemoving === String(member.id) ? 'Removing…' : 'Remove from group'}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No active members are assigned to this group.</p>
                  )}
                  {smallGroupMessage && <p role="status" className="mt-2 text-sm text-emerald-700">{smallGroupMessage}</p>}
                </>
              ) : null}
            </section>
          )}
          {isKspLeader && (
            <AttendanceMonitoringPanel
              getIdToken={getIdToken}
              apiBaseUrl={apiBaseUrl}
            />
          )}
          {hasDesignatedTeam && groupError && (
            <p role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Group tools are unavailable: {groupError}
            </p>
          )}

          {children}
          {canViewReports && (
            <AttendanceReportsPanel
              getIdToken={getIdToken}
              apiBaseUrl={apiBaseUrl}
            />
          )}
        </section>

        <MemberQRCode user={user} open={qrOpen} onClose={() => setQrOpen(false)} showTrigger={false} />
        <ConfirmationModal
          open={Boolean(confirmation)}
          title={confirmation?.title || ''}
          message={confirmation?.message || ''}
          confirmText={confirmation?.confirmText || 'Confirm'}
          onConfirm={confirmPendingAction}
          onCancel={cancelConfirmation}
        />

        {profileOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/60 p-2 backdrop-blur-sm sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setProfileOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-profile-title"
              className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-y-auto rounded-3xl border border-white/30 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[calc(100dvh-2rem)]"
            >
              <header className="flex shrink-0 items-center justify-between bg-emerald-950 px-4 py-3 text-white sm:px-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">Account settings</p>
                  <h2 id="edit-profile-title" className="mt-0.5 text-lg font-bold">Edit Profile</h2>
                </div>
                <button
                  type="button"
                  aria-label="Close edit profile"
                  onClick={() => setProfileOpen(false)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 text-xl text-white/90 transition hover:bg-white/10"
                >
                  ×
                </button>
              </header>
              <div className="mx-3 mt-3 flex shrink-0 items-center gap-3 rounded-xl bg-slate-50 p-3 sm:mx-5 dark:bg-slate-800">
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-100 text-xl font-bold text-violet-700">
                    {profileName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs font-bold text-slate-800 dark:text-slate-100">Change profile picture</p>
                  <ImageUpload
                    getIdToken={getIdToken}
                    apiBaseUrl={apiBaseUrl}
                    folder="profile-pictures"
                    label="Upload a profile picture"
                    compact
                    onUploaded={async (image) => {
                      await apiRequest('/auth/profile-picture', {
                        getIdToken,
                        apiBaseUrl,
                        method: 'PATCH',
                        body: JSON.stringify({
                          profilePicture: image.secure_url,
                          publicId: image.public_id,
                        }),
                      });
                      await refreshProfile();
                    }}
                  />
                </div>
              </div>
              <form className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 sm:p-5" onSubmit={saveProfile}>
                <label className="col-span-2 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Full name
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={profileDraft.displayName}
                    onChange={(event) => setProfileDraft((draft) => ({ ...draft, displayName: event.target.value }))}
                    className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Phone number
                  <input
                    type="tel"
                    maxLength={32}
                    value={profileDraft.phoneNumber}
                    onChange={(event) => setProfileDraft((draft) => ({ ...draft, phoneNumber: event.target.value }))}
                    className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Birthday
                  <input
                    type="date"
                    value={profileDraft.birthDate}
                    onChange={(event) => setProfileDraft((draft) => ({ ...draft, birthDate: event.target.value }))}
                    className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <div className="col-span-2 flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setProfileOpen(false)}
                    className="min-h-10 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileBusy}
                    className="min-h-10 rounded-xl bg-emerald-900 px-5 py-2 text-sm font-bold text-white transition hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {profileBusy ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
              <section className="border-t border-slate-200 px-3 py-4 sm:px-5 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {firebaseUser?.providerData.some(({ providerId }) => providerId === 'password')
                    ? 'Update password'
                    : 'Set password'}
                </h3>
                <form className="mt-3 space-y-3" onSubmit={savePassword}>
                  {firebaseUser?.providerData.some(({ providerId }) => providerId === 'password') && (
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Current password
                      <input
                        type="password"
                        autoComplete="current-password"
                        required
                        value={passwordDraft.currentPassword}
                        onChange={(event) => setPasswordDraft((draft) => ({ ...draft, currentPassword: event.target.value }))}
                        className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                  )}
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      New password
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        required
                        value={passwordDraft.newPassword}
                        onChange={(event) => setPasswordDraft((draft) => ({ ...draft, newPassword: event.target.value }))}
                        className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                      />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Confirm new password
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        required
                        value={passwordDraft.confirmPassword}
                        onChange={(event) => setPasswordDraft((draft) => ({ ...draft, confirmPassword: event.target.value }))}
                        className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                      />
                  </label>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={passwordBusy}
                      className="min-h-10 rounded-xl bg-emerald-900 px-5 py-2 text-sm font-bold text-white transition hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {passwordBusy
                        ? 'Saving…'
                        : firebaseUser?.providerData.some(({ providerId }) => providerId === 'password')
                          ? 'Update password'
                          : 'Set password'}
                    </button>
                  </div>
                </form>
              </section>
            </section>
          </div>
        )}

        <aside className="hidden flex-col space-y-4 border-l border-slate-200 bg-[#fbfbfe] px-2.5 py-5 xl:flex xl:px-4 dark:border-slate-700 dark:bg-slate-950">
          <section className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
            {photo ? (
              <img src={photo} alt="" className="mx-auto h-16 w-16 rounded-full object-cover ring-4 ring-violet-50" />
            ) : (
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-violet-100 text-xl font-bold text-violet-700">{profileName.charAt(0).toUpperCase()}</span>
            )}
            <h2 className="mt-3 font-bold text-slate-900">Good day, {profileName.split(' ')[0]} ✨</h2>
            <p className="mt-1 text-xs text-slate-500">{user?.role === 'admin' ? designationText ? `Administrator · ${designationText}` : 'Administrator' : user?.role === 'pastor' ? 'Pastoral team' : designationText || 'Church family'}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-violet-50">
              <div className="h-full rounded-full bg-violet-500" style={{ width: `${profileCompletion}%` }} />
            </div>
            <p className="mt-2 text-[10px] text-slate-400">Profile details {profileCompletion}% complete</p>
          </section>

          {canViewLeaderboard ? (
            <Link
              to="/leaderboards"
              aria-label="View full attendance leaderboard"
              className="block rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-300 dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Attendance leaderboard</span>
                <span className="text-[10px] text-slate-400">View all →</span>
              </span>
              <span className="mt-4 flex h-28 items-end justify-around gap-3 border-b border-dashed border-slate-200 px-2 dark:border-slate-700">
                {attendanceLeaderboard.slice(0, 3).map((member, index) => {
                  const topCount = Math.max(
                    1,
                    ...attendanceLeaderboard.slice(0, 3).map((item) => item.presentCount)
                  );
                  const height = member.presentCount
                    ? Math.max(12, Math.round((member.presentCount / topCount) * 78))
                    : 8;
                  return (
                    <span key={member.memberId} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{member.presentCount}</span>
                      <span
                        className={`w-full max-w-12 rounded-t-lg ${
                          ['bg-amber-400', 'bg-violet-500', 'bg-emerald-500'][index]
                        }`}
                        style={{ height: `${height}px` }}
                      />
                      <span className="w-full truncate pb-1 text-center text-[9px] text-slate-500 dark:text-slate-400">
                        {member.memberName}
                      </span>
                    </span>
                  );
                })}
                {!attendanceLeaderboard.length && (
                  <span className="pb-3 text-xs text-slate-500">
                    {analytics ? 'No attendance recorded' : 'Loading leaderboard…'}
                  </span>
                )}
              </span>
              <span className="mt-2 block text-center text-[10px] text-slate-400">Present attendances · Top 3</span>
            </Link>
          ) : null}

          <VerseOfDayCard
            id="verse-of-day"
            verse={verse}
            verseError={verseError}
            verseReaction={verseReaction}
            onToggleReaction={toggleVerseReaction}
          />

          <section id="birthday-celebrants" className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Birthday celebrants</h2>
                <p className="text-[10px] text-slate-400">{new Date().toLocaleString(undefined, { month: 'long' })}</p>
              </div>
              <a href="#birthday-celebrants" aria-label="Birthday celebrants" className="grid h-7 w-7 place-items-center rounded-full bg-pink-50 text-pink-600 hover:bg-pink-100">🎂</a>
            </div>
            {birthdays.length ? (
              <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                {birthdays.map((birthday) => (
                  <div key={birthday.id} className="border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                    <div className="flex items-center gap-2">
                      {birthday.profilePicture ? (
                        <img src={birthday.profilePicture} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-pink-50 text-xs font-bold text-pink-600">{birthday.name?.charAt(0)}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{birthday.name}</p>
                        <p className="text-[10px] text-slate-400">{monthDay(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), birthday.day)))} {new Date().toLocaleString(undefined, { month: 'short' })}</p>
                      </div>
                      <button type="button" onClick={() => toggleReaction('birthday', birthday.id)} aria-label={`Send birthday greeting to ${birthday.name}`} aria-pressed={isReacted(birthday.reactions, user?._id)} className={`text-xs ${isReacted(birthday.reactions, user?._id) ? 'text-pink-600' : 'text-slate-400'}`}>
                        ♥ {birthday.reactions?.length || 0}
                      </button>
                    </div>
                    {(birthday.comments || []).slice(-1).map((comment) => (
                      <div key={comment._id} className="mt-2 flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-[10px] text-slate-500 dark:text-slate-300">
                          <b>{comment.user?.displayName || 'Member'}:</b> {comment.body}
                        </p>
                        <button
                          type="button"
                          aria-label={`React to ${comment.user?.displayName || 'member'}'s birthday greeting`}
                          aria-pressed={isReacted(comment.reactions, user?._id)}
                          onClick={() => toggleCommentReaction('birthday', birthday.id, comment._id)}
                          className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] ${
                            isReacted(comment.reactions, user?._id)
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
                              : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30'
                          }`}
                        >
                          ♥ {comment.reactions?.length || 0}
                        </button>
                      </div>
                    ))}
                    <form className="mt-2 flex gap-1.5" onSubmit={(event) => { event.preventDefault(); addComment('birthday', birthday.id); }}>
                      <input
                        value={commentDrafts[`birthday-${birthday.id}`] || ''}
                        onChange={(event) => setCommentDrafts((drafts) => ({ ...drafts, [`birthday-${birthday.id}`]: event.target.value }))}
                        maxLength={1000}
                        aria-label={`Write birthday greeting for ${birthday.name}`}
                        placeholder="Write a greeting…"
                        className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-[10px] outline-none focus:border-pink-300"
                      />
                      <button className="rounded-md bg-pink-50 px-2 text-[10px] font-semibold text-pink-700">Send</button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-5 text-slate-500">No birthdays have been added for this month yet.</p>
            )}
          </section>

        </aside>
      </div>
    </main>
  );
}
