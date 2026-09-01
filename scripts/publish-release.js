// Publica uma nova versao no GitHub Releases, para o auto-update (electron-updater) do 365 TV.
//
// O modo "--publish always" embutido do electron-builder se mostrou instavel aqui
// (chegou a criar releases duplicadas e sem tag valida numa conta nova). Este script
// faz o mesmo trabalho de forma explicita e verificavel: builda localmente, confirma
// que o latest.yml bate com o instalador gerado, e so entao cria/publica a release
// e sobe os arquivos via API do GitHub.
//
// Uso: defina a variavel de ambiente GH_TOKEN (um Personal Access Token com escopo
// "repo") e rode `npm run release`.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const pkg = require('../package.json');
const { owner, repo } = pkg.build.publish;
const version = pkg.version;
const tag = `v${version}`;
const releaseDir = path.join(__dirname, '..', 'release');

const token = process.env.GH_TOKEN;
if (!token) {
  console.error('GH_TOKEN nao definido no ambiente. Configure-o antes de publicar.');
  process.exit(1);
}

function gh(method, url, body) {
  const isUpload = url.startsWith('https://uploads.github.com');
  const args = [
    '-s', '-w', '\n%{http_code}',
    '-X', method,
    '-H', `Authorization: token ${token}`,
    '-H', 'User-Agent: 365tv-release-script',
    '-H', `Content-Type: ${isUpload ? 'application/octet-stream' : 'application/json'}`
  ];
  if (body && !isUpload) args.push('-d', JSON.stringify(body));
  if (body && isUpload) args.push('--data-binary', `@${body}`);
  args.push(url);

  const out = execFileSync('curl', args, { encoding: 'utf-8' });
  const idx = out.lastIndexOf('\n');
  const status = Number(out.slice(idx + 1));
  const text = out.slice(0, idx);
  const json = text ? JSON.parse(text) : null;
  if (status >= 400) {
    throw new Error(`GitHub API ${method} ${url} -> ${status}: ${text}`);
  }
  return json;
}

console.log(`1/4 Compilando instalador (versao ${version})...`);
execFileSync('npx', ['electron-builder', '--win', '--x64'], { stdio: 'inherit', shell: true });

console.log('2/4 Verificando consistencia do latest.yml...');
const exeName = `365-TV-Setup-${version}.exe`;
const exePath = path.join(releaseDir, `365 TV Setup ${version}.exe`);
const blockmapPath = `${exePath}.blockmap`;
const latestYmlPath = path.join(releaseDir, 'latest.yml');

const exeBuffer = fs.readFileSync(exePath);
const actualHash = crypto.createHash('sha512').update(exeBuffer).digest('base64');
const latestYml = fs.readFileSync(latestYmlPath, 'utf-8');
if (!latestYml.includes(actualHash)) {
  console.error('latest.yml nao bate com o hash do instalador gerado — abortando.');
  process.exit(1);
}
console.log('   OK: hash confere.');

console.log('3/4 Criando release no GitHub...');
// Remove qualquer tentativa anterior com a mesma tag antes de recriar.
try {
  const existing = gh('GET', `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`);
  if (existing && existing.id) {
    gh('DELETE', `https://api.github.com/repos/${owner}/${repo}/releases/${existing.id}`);
    console.log(`   release anterior com tag ${tag} removida.`);
  }
} catch {
  // nao existe ainda — segue normalmente
}

const release = gh('POST', `https://api.github.com/repos/${owner}/${repo}/releases`, {
  tag_name: tag,
  target_commitish: 'main',
  name: `365 TV ${version}`,
  draft: false,
  prerelease: false
});
console.log(`   release criada: ${release.html_url}`);

console.log('4/4 Enviando arquivos...');
const uploads = [
  { file: exePath, name: exeName },
  { file: blockmapPath, name: `${exeName}.blockmap` },
  { file: latestYmlPath, name: 'latest.yml' }
];
for (const u of uploads) {
  const url = `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(u.name)}`;
  const uploaded = gh('POST', url, u.file);
  console.log(`   ${uploaded.name} (${uploaded.size} bytes)`);
}

console.log(`\nPublicado: ${release.html_url}`);
