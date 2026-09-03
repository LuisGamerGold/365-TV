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

function refreshMusicWidgetVisibility() {
  MusicWidgetModule.applyConfig({
    enabled: musicWidgetConfig.enabled && spotifyConnected,
    position: musicWidgetConfig.position
  });
}

socket.on('videos:updated', (videos) => VideoPlayerModule.applyPlaylist(videos));
socket.on('promo:updated', (promo) => PromoBarModule.applyState(promo));
socket.on('oferta:updated', (oferta) => OfertaPlayerModule.applyState(oferta));
socket.on('weatherScreen:updated', (weatherScreen) => WeatherScreenModule.applyState(weatherScreen));

socket.on('music:updated', (music) => {
  spotifyConnected = Boolean(music.spotify.connected);
  refreshMusicWidgetVisibility();
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
  refreshMusicWidgetVisibility();
});
