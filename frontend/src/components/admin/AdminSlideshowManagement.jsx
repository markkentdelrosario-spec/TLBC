import { LOCAL_WELCOME_SLIDES } from '../../utils/localSlideshow';

export default function AdminSlideshowManagement() {
  return (
    <section
      id="slideshow-management"
      className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900"
    >
      <header className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">Admin settings</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">Welcome slideshow</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
          These bundled images are served directly from the frontend. Add or replace files in
          <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">public/images/slideshow/</code>
          and update the local slide list before deploying.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {LOCAL_WELCOME_SLIDES.map((slide) => (
          <article key={slide.id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <img src={slide.src} alt="" className="h-40 w-full bg-slate-900 object-cover" />
            <div className="p-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">{slide.title}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{slide.caption}</p>
              <code className="mt-2 block break-all text-xs text-slate-400">{slide.src}</code>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
