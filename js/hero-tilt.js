// ЭкоНорма – картинка первого экрана слегка наклоняется за курсором, штамп сдвигается сильнее (параллакс)
(function () {
  var art = document.getElementById('heroArt');
  if (!art || !matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var img = art.querySelector('.hero-main'), stamp = art.querySelector('.hero-art-stamp'), raf = 0;
  art.addEventListener('mousemove', function (e) {
    var r = art.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      art.classList.add('tilting');
      art.style.setProperty('--mx', (x + 0.5) * 100 + '%'); art.style.setProperty('--my', (y + 0.5) * 100 + '%');
      img.style.transform = 'perspective(1200px) rotateY(' + (x * 8) + 'deg) rotateX(' + (-y * 6) + 'deg) scale(1.03)';
      if (stamp) stamp.style.transform = 'translate(' + (x * -22) + 'px,' + (y * -16) + 'px) rotate(' + (-12 + x * 6) + 'deg)';
    });
  });
  art.addEventListener('mouseleave', function () {
    cancelAnimationFrame(raf); art.classList.remove('tilting');
    img.style.transform = ''; if (stamp) stamp.style.transform = '';
  });
})();
