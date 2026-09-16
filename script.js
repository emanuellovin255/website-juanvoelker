// Configuración de contacto: completa estos datos para activar el formulario y el enlace.
const CONTACT = {
  email: '',      // p. ej. 'contacto@condordentallab.com'
  instagram: '',  // p. ej. 'https://www.instagram.com/usuario'
};

// Nav: fondo al hacer scroll + menú móvil
const nav = document.getElementById('nav');
const toggle = document.getElementById('navToggle');
const links = document.getElementById('navLinks');

const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 20);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const setMenu = (open) => {
  links.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  document.body.classList.toggle('menu-open', open);
};
toggle.addEventListener('click', () => setMenu(!links.classList.contains('is-open')));
links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

// Enlace activo según la sección visible
const navAnchors = [...links.querySelectorAll('a[href^="#"]:not(.btn)')];
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navAnchors.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === `#${entry.target.id}`));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('main section[id]').forEach((s) => sectionObserver.observe(s));

// Animaciones al aparecer
const revealObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    obs.unobserve(entry.target);
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 70}ms`;
  revealObserver.observe(el);
});

// Galería: detectar fotos reales en assets/img/
document.querySelectorAll('.work').forEach((work) => {
  const match = work.style.getPropertyValue('--img').match(/url\(['"]?(.*?)['"]?\)/);
  if (!match) return;
  const img = new Image();
  img.onload = () => work.classList.add('has-img');
  img.onerror = () => work.style.removeProperty('--img');
  img.src = match[1];
});

// Filtros de la galería
const filters = document.querySelectorAll('.filter');
filters.forEach((btn) => {
  btn.addEventListener('click', () => {
    const cat = btn.dataset.filter;
    filters.forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', String(b === btn));
    });
    document.querySelectorAll('.work').forEach((work) => {
      work.classList.toggle('is-hidden', cat !== 'all' && work.dataset.cat !== cat);
    });
  });
});

// Instagram
const insta = document.getElementById('instaLink');
if (CONTACT.instagram) insta.href = CONTACT.instagram;
else insta.hidden = true;

// Formulario: abre el correo con el mensaje preparado
const form = document.getElementById('contactForm');
const note = document.getElementById('formNote');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  let valid = true;
  form.querySelectorAll('[required]').forEach((field) => {
    const ok = field.value.trim() && field.checkValidity();
    field.classList.toggle('is-invalid', !ok);
    if (!ok) valid = false;
  });
  note.className = 'form__note';
  if (!valid) {
    note.textContent = 'Revisa los campos marcados.';
    note.classList.add('is-err');
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  const body = [
    `Nombre: ${data.nombre}`,
    `Clínica: ${data.clinica || '-'}`,
    `Correo: ${data.email}`,
    `Tipo de trabajo: ${data.tipo}`,
    '',
    data.mensaje,
  ].join('\n');

  if (CONTACT.email) {
    const subject = `Solicitud de trabajo — ${data.tipo}`;
    window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    note.textContent = 'Abriendo tu cliente de correo…';
  } else {
    navigator.clipboard?.writeText(body).catch(() => {});
    note.textContent = 'Mensaje copiado. Envíanoslo por mensaje directo.';
    if (CONTACT.instagram) window.open(CONTACT.instagram, '_blank', 'noopener');
  }
  note.classList.add('is-ok');
  form.reset();
});

document.getElementById('year').textContent = new Date().getFullYear();
