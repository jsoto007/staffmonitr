import { testimonials } from './data';

export const TestimonialSection = () => (
  <section id="testimonials" className="bg-slate-900 py-20 text-white dark:bg-slate-950">
    <div className="mx-auto max-w-8xl px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-indigo-300">Testimonials</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Loved by on-site operators</h2>
        <p className="mt-3 text-lg text-slate-300">
          Hard data, thoughtful alerts, and responsive support make every rhythm easier to manage.
        </p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {testimonials.map((testimonial) => (
          <figure
            key={testimonial.author}
            className="flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-6 leading-relaxed backdrop-blur"
          >
            <blockquote className="text-lg font-semibold text-white">“{testimonial.quote}”</blockquote>
            <figcaption className="mt-6 text-sm text-slate-300">
              <p className="font-semibold text-white">{testimonial.author}</p>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{testimonial.role}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  </section>
);
