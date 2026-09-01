// Interface que qualquer provedor de musica deve implementar.
// Isso permite trocar o Spotify por outro servico (ex: Soundtrack Your Brand,
// ou uma playlist local) sem alterar rotas nem o widget do player.
class MusicProvider {
  async isConnected() {
    throw new Error('nao implementado');
  }

  async play(contextUri) {
    throw new Error('nao implementado');
  }

  async pause() {
    throw new Error('nao implementado');
  }

  async next() {
    throw new Error('nao implementado');
  }

  async previous() {
    throw new Error('nao implementado');
  }

  async setVolume(percent) {
    throw new Error('nao implementado');
  }

  async getNowPlaying() {
    throw new Error('nao implementado');
  }

  async listDevices() {
    throw new Error('nao implementado');
  }

  async selectDevice(deviceId) {
    throw new Error('nao implementado');
  }
}

module.exports = MusicProvider;
