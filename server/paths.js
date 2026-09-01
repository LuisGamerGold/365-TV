const path = require('path');

// Quando roda dentro do Electron empacotado, os dados do usuario (videos,
// senha, tokens) devem ficar na pasta de dados do usuario (userData), nao
// dentro da propria instalacao — que pode nao ter permissao de escrita e e'
// substituida a cada atualizacao/reinstalacao.
let dataDir;
try {
  const { app } = require('electron');
  dataDir = path.join(app.getPath('userData'), 'data');
} catch {
  dataDir = path.join(__dirname, '..', 'data');
}

module.exports = { DATA_DIR: dataDir };
