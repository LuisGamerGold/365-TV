const socket = io();

// Canvas fixo 1920x1080 (ver player.css #screen): escala o layout inteiro
// para caber na tela real, preservando as proporcoes exatas do design.
function fitScreen() {
  const screen = document.getElementById('screen');
  const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  screen.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
addEventListener('resize', fitScreen);
addEventListener('load', fitScreen);
fitScreen();

ClockModule.start();

let musicWidgetConfig = { enabled: true, position: 'bottom-right' };
let spotifyConnected = false;
let promoConfig = { position: 'bottom' };
let logoConfig = { enabled: true, position: 'top-right' };
let infoPillConfig = { position: 'top-left' };
let infoPillActive = false;

function refreshMusicWidgetVisibility() {
  MusicWidgetModule.applyConfig({
    enabled: musicWidgetConfig.enabled && spotifyConnected,
    position: musicWidgetConfig.position
  });
}

// A tarjeta (#promo-bar) e os widgets ancorados (logo/relogio-clima/musica)
// tem posicionamento independente um do outro - se algum widget calhar de
// ficar ancorado no mesmo lado (cima/baixo) que a tarjeta, os dois disputam
// a mesma faixa vertical da tela e o texto de um vaza por cima do outro.
// Aqui a gente confere isso toda vez que alguma config muda e da' um respiro
// extra pra tarjeta (classe "needs-clearance", ver player.css) so' quando
// realmente ha' conflito.
function sideOf(position) {
  return (position || '').startsWith('top') ? 'top' : 'bottom';
}

function updatePromoClearance() {
  const promoSide = promoConfig.position === 'top' ? 'top' : 'bottom';
  const conflita =
    (logoConfig.enabled && sideOf(logoConfig.position) === promoSide) ||
    (infoPillActive && sideOf(infoPillConfig.position) === promoSide) ||
    (musicWidgetConfig.enabled && spotifyConnected && sideOf(musicWidgetConfig.position) === promoSide);
  document.getElementById('promo-bar').classList.toggle('needs-clearance', conflita);
}

socket.on('videos:updated', (videos) => VideoPlayerModule.applyPlaylist(videos));
socket.on('promo:updated', (promo) => {
  PromoBarModule.applyState(promo);
  promoConfig = promo;
  updatePromoClearance();
});
socket.on('oferta:updated', (oferta) => OfertaPlayerModule.applyState(oferta));
socket.on('weatherScreen:updated', (weatherScreen) => WeatherScreenModule.applyState(weatherScreen));

socket.on('music:updated', (music) => {
  spotifyConnected = Boolean(music.spotify.connected);
  refreshMusicWidgetVisibility();
  updatePromoClearance();
});
socket.on('music:nowplaying', (track) => MusicWidgetModule.applyNowPlaying(track));

socket.on('widgets:updated', (widgets) => {
  ClockModule.applyConfig(widgets.clock);
  WeatherModule.applyConfig(widgets.weather);
  WeatherScreenModule.applyWeatherConfig(widgets.weather);
  LogoModule.applyConfig(widgets.logo);
  InfoPillModule.applyConfig({
    position: widgets.infoPill.position,
    cycleSeconds: widgets.infoPill.cycleSeconds,
    clockEnabled: widgets.clock.enabled,
    weatherEnabled: widgets.weather.enabled
  });
  musicWidgetConfig = widgets.music;
  logoConfig = widgets.logo;
  infoPillConfig = widgets.infoPill;
  infoPillActive = Boolean(widgets.clock.enabled || widgets.weather.enabled);
  refreshMusicWidgetVisibility();
  updatePromoClearance();
});
