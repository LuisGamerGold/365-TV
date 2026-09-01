const socket = io();

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

socket.on('music:updated', (music) => {
  spotifyConnected = Boolean(music.spotify.connected);
  refreshMusicWidgetVisibility();
});
socket.on('music:nowplaying', (track) => MusicWidgetModule.applyNowPlaying(track));

socket.on('widgets:updated', (widgets) => {
  ClockModule.applyConfig(widgets.clock);
  WeatherModule.applyConfig(widgets.weather);
  LogoModule.applyConfig(widgets.logo);
  musicWidgetConfig = widgets.music;
  refreshMusicWidgetVisibility();
});
