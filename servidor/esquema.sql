-- Nexus Safe · banco D1 (SQLite). Rodar uma vez em banco novo:
--   npx wrangler d1 execute nexus-safe --local --file servidor/esquema.sql
-- Datas em texto ISO 8601 (UTC). Ficha, rascunho e token do link ficam cifrados (AES-GCM) pelo Worker.

CREATE TABLE IF NOT EXISTS agencias (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL DEFAULT '',
  contato TEXT NOT NULL DEFAULT '',
  tel TEXT NOT NULL DEFAULT '',
  situacao TEXT NOT NULL DEFAULT 'implantacao',
  servicos TEXT NOT NULL DEFAULT '[]',
  endereco TEXT NOT NULL DEFAULT '',
  horario TEXT NOT NULL DEFAULT '',
  pcmso TEXT NOT NULL DEFAULT '{}',
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS empresas (
  id TEXT PRIMARY KEY,
  agencia_id TEXT NOT NULL REFERENCES agencias(id),
  nome TEXT NOT NULL,
  cnpj TEXT NOT NULL DEFAULT '',
  contato TEXT NOT NULL DEFAULT '',
  tel TEXT NOT NULL DEFAULT '',
  grau_risco INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS empresas_agencia ON empresas(agencia_id);

CREATE TABLE IF NOT EXISTS funcoes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  setor TEXT NOT NULL DEFAULT '',
  riscos TEXT NOT NULL DEFAULT '[]',
  exames TEXT NOT NULL DEFAULT '[]',
  periodicidade INTEGER NOT NULL DEFAULT 12
);
CREATE INDEX IF NOT EXISTS funcoes_empresa ON funcoes(empresa_id);

-- tipo: admin (Nexus Safe), clinica (papel recepcao ou medico), rh (preso a empresa_id)
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('admin', 'clinica', 'rh')),
  papel TEXT NOT NULL DEFAULT '',
  crm TEXT NOT NULL DEFAULT '',
  agencia_id TEXT REFERENCES agencias(id),
  empresa_id TEXT REFERENCES empresas(id),
  senha TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  falhas INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate TEXT,
  CHECK (tipo <> 'clinica' OR agencia_id IS NOT NULL),
  CHECK (tipo <> 'rh' OR empresa_id IS NOT NULL)
);

-- id = SHA-256 do token do cookie; o token em si nunca é gravado
CREATE TABLE IF NOT EXISTS sessoes (
  id TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  criada_em TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS sessoes_expira ON sessoes(expira_em);

-- dados = o atendimento sem ficha, rascunho e token (cadastro, agenda, ASO, histórico)
CREATE TABLE IF NOT EXISTS atendimentos (
  id TEXT PRIMARY KEY,
  agencia_id TEXT NOT NULL REFERENCES agencias(id),
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  funcao_id TEXT NOT NULL REFERENCES funcoes(id),
  etapa TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  dados TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS atendimentos_agencia ON atendimentos(agencia_id, criado_em);
CREATE INDEX IF NOT EXISTS atendimentos_empresa ON atendimentos(empresa_id);

-- ficha e rascunho cifrados; só a equipe médica recebe a ficha decifrada
CREATE TABLE IF NOT EXISTS fichas (
  atendimento_id TEXT PRIMARY KEY REFERENCES atendimentos(id),
  ficha TEXT,
  rascunho TEXT,
  enviado_em TEXT,
  atualizado_em TEXT NOT NULL
);

-- token_hash = SHA-256 do token do link; token_cifrado deixa a recepção reenviar o mesmo link
CREATE TABLE IF NOT EXISTS links (
  token_hash TEXT PRIMARY KEY,
  atendimento_id TEXT NOT NULL REFERENCES atendimentos(id),
  token_cifrado TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  usado_em TEXT,
  revogado INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS links_atendimento ON links(atendimento_id);

CREATE TABLE IF NOT EXISTS automacoes (
  agencia_id TEXT NOT NULL REFERENCES agencias(id),
  id TEXT NOT NULL,
  nome TEXT NOT NULL,
  quando TEXT NOT NULL DEFAULT '',
  para TEXT NOT NULL DEFAULT '',
  ativo INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agencia_id, id)
);

CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agencia_id TEXT NOT NULL REFERENCES agencias(id),
  em TEXT NOT NULL,
  automacao TEXT NOT NULL,
  para TEXT NOT NULL,
  texto TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mensagens_agencia ON mensagens(agencia_id, em);

CREATE TABLE IF NOT EXISTS chamados (
  id TEXT PRIMARY KEY,
  agencia_id TEXT NOT NULL REFERENCES agencias(id),
  situacao TEXT NOT NULL,
  aberto_em TEXT NOT NULL,
  dados TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chamados_agencia ON chamados(agencia_id, aberto_em);

-- quem fez o quê: login, login errado, ficha aberta
CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  em TEXT NOT NULL,
  usuario_id INTEGER,
  acao TEXT NOT NULL,
  alvo TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS auditoria_em ON auditoria(em);

-- limite de tentativas (janela fixa)
CREATE TABLE IF NOT EXISTS limites (
  chave TEXT PRIMARY KEY,
  contagem INTEGER NOT NULL,
  expira INTEGER NOT NULL
);
