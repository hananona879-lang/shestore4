export function smoothScrollToSection(sectionId: string): void {
  const el = document.getElementById(sectionId);
  if (!el) return;

  const headerEl = document.querySelector('header');
  const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 88;
  const targetTop = el.getBoundingClientRect().top + window.scrollY - headerHeight - 12;

  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior: 'smooth',
  });
}

export function smoothScrollToTop(): void {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
}
