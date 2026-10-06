# STUDY VAULT — MASTER DEVELOPMENT SPECIFICATION
## Especificação Mestre para Desenvolvimento Profissional, SaaS-Ready e Integração com JARVIS

> **Instrução principal para Claude:** você é o responsável técnico pelo desenvolvimento desta plataforma. Desenvolva como um **Engenheiro de Software Full-Stack Senior / Staff**, com foco em arquitetura, segurança, escalabilidade, qualidade, testes, observabilidade e manutenção de longo prazo.
>
> **Não faça um protótipo superficial. Não invente funcionalidades fora deste documento. Não simplifique requisitos críticos sem registrar a decisão. Não substitua arquitetura por atalhos.**
>
> A plataforma deve nascer como uma aplicação pessoal de estudos, mas sua arquitetura deve ser **multi-tenant e preparada para evolução para SaaS**, sem necessidade de reescrever o núcleo posteriormente.
>
> O **JARVIS**, assistente de IA do proprietário, deve ser considerado uma integração estratégica desde a primeira versão. A plataforma deve expor uma camada de API/Tools segura e estável para que o JARVIS possa consultar e, mediante permissões explícitas, operar sobre arquivos, pastas, notas e dados de estudo.

---

# 1. VISÃO DO PRODUTO

## 1.1 Nome de trabalho

**Study Vault**

O nome poderá ser alterado posteriormente sem modificar a arquitetura.

## 1.2 Propósito

Criar uma plataforma web/PWA para centralizar:

- arquivos de estudo;
- pastas e subpastas;
- notas;
- materiais para concursos;
- documentos;
- PDFs;
- imagens;
- vídeos;
- áudios;
- arquivos compactados;
- arquivos Markdown;
- dados de estudo;
- integração com Obsidian;
- pesquisa sobre o acervo;
- futura inteligência artificial/RAG;
- integração profunda com o JARVIS.

A plataforma deverá permitir acesso seguro a partir de diferentes dispositivos.

## 1.3 Visão futura

A plataforma deve poder evoluir para:

- SaaS multiusuário;
- planos gratuitos e pagos;
- workspaces;
- equipes;
- compartilhamento;
- cobrança;
- limites de armazenamento;
- integrações;
- IA;
- RAG;
- assistente de estudos;
- automações;
- colaboração.

---

# 2. PRINCÍPIOS DE ENGENHARIA

Claude deve seguir obrigatoriamente estes princípios:

1. Segurança por padrão.
2. Server-side authorization.
3. Multi-tenancy desde o início.
4. RLS no banco.
5. Nunca confiar no frontend para autorização.
6. Separar domínio, infraestrutura e apresentação.
7. Código tipado.
8. Validação de entrada em todas as fronteiras.
9. APIs versionadas.
10. Operações sensíveis auditáveis.
11. Testes automatizados.
12. Observabilidade.
13. Tratamento explícito de erros.
14. Idempotência onde necessário.
15. Uploads robustos e preparados para arquivos grandes.
16. Não acoplar JARVIS ao banco ou Storage.
17. Não acoplar o domínio à implementação específica do Supabase.
18. Documentação viva.
19. Nenhuma funcionalidade crítica deve depender exclusivamente de comportamento do cliente.
20. Preferir soluções simples, sólidas e evolutivas a complexidade prematura.

---

# 3. STACK OFICIAL

## Frontend

- Next.js
- React
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui

## Backend

- Next.js Route Handlers / Server Actions quando apropriado
- camada de serviços/domínio
- APIs REST versionadas
- Supabase como infraestrutura inicial

## Banco

- PostgreSQL
- Supabase
- Row Level Security

## Autenticação

- Supabase Auth

## Storage

- Supabase Storage

## Deploy

- Vercel

## Versionamento

- GitHub

## PWA

- Web App Manifest
- Service Worker
- estratégia de cache adequada
- suporte a instalação

## Testes

Escolher ferramentas modernas e maduras para:

- unit;
- integration;
- E2E;
- acessibilidade;
- segurança básica;
- testes de API.

Preferir Vitest/Jest para unit/integration e Playwright para E2E, salvo justificativa técnica documentada.

## IA

A arquitetura deve permitir posteriormente:

- embeddings;
- vector search;
- RAG;
- AI Gateway;
- múltiplos provedores de LLM.

Não implementar IA complexa no MVP sem necessidade.

---

# 4. ARQUITETURA DE ALTO NÍVEL

```text
                         ┌──────────────────────────┐
                         │          USUÁRIO         │
                         │ PC / Notebook / Mobile   │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │       STUDY VAULT        │
                         │         PWA/Web           │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │      Application Layer   │
                         │ Auth / UI / API / Domain │
                         └────────────┬─────────────┘
                                      │
              ┌───────────────────────┼────────────────────────┐
              │                       │                        │
              ▼                       ▼                        ▼
       Authentication            Domain/API              Sync Engine
              │                       │                        │
              └───────────────────────┼────────────────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │         Supabase         │
                         │                          │
                         │ PostgreSQL               │
                         │ Auth                     │
                         │ Storage                  │
                         │ RLS                      │
                         └────────────┬─────────────┘
                                      │
                    ┌─────────────────┼──────────────────┐
                    │                 │                  │
                    ▼                 ▼                  ▼
                 Files             Metadata          Audit Logs
                    │
                    ▼
             Object Storage

      ┌───────────────────────────────┐
      │            JARVIS             │
      │       AI Assistant            │
      └───────────────┬───────────────┘
                      │
                Secure API/Tools
                      │
                      ▼
              ┌───────────────┐
              │ AI Gateway /  │
              │ Tool Layer    │
              └───────┬───────┘
                      │
                      ▼
               Study Vault API

      ┌───────────────────────────────┐
      │            OBSIDIAN           │
      │          PC + Mobile          │
      └───────────────┬───────────────┘
                      │
                 Sync Protocol
                      │
                      ▼
                 Sync Engine
```

---

# 5. REGRA FUNDAMENTAL DE ARQUITETURA

O JARVIS **NUNCA** deverá acessar diretamente:

- PostgreSQL;
- tabelas;
- buckets;
- credenciais administrativas;
- service role key;
- infraestrutura interna.

Fluxo obrigatório:

```text
JARVIS
  ↓
Authentication
  ↓
AI Gateway / Tool Layer
  ↓
Study Vault API
  ↓
Authorization
  ↓
Domain Service
  ↓
Database / Storage
```

Isso permite trocar a infraestrutura no futuro sem quebrar o JARVIS.

---

# 6. MULTI-TENANCY

A plataforma deve nascer SaaS-ready.

Modelo:

```text
User
  ↓
Workspace
  ↓
Workspace Member
  ↓
Folders / Files / Notes / Studies
```

Nunca modelar o sistema como simples:

```text
user → files
```

Preferir:

```text
workspace → resources
```

O usuário pessoal inicial terá um workspace próprio.

Futuramente:

```text
Workspace pessoal
Workspace equipe
Workspace empresa
Workspace compartilhado
```

---

# 7. PAPÉIS E PERMISSÕES

Criar inicialmente:

- Owner
- Admin
- Member
- Viewer

Preparar arquitetura para permissões granulares.

Exemplo:

```text
files.read
files.create
files.update
files.move
files.delete
files.restore

folders.read
folders.create
folders.update
folders.delete

notes.read
notes.create
notes.update
notes.delete

study.read
study.write

integration.read
integration.write

workspace.manage
members.manage

billing.manage
```

---

# 8. PERMISSÕES DO JARVIS

O JARVIS deverá ter escopos próprios.

Exemplo:

```text
jarvis.study.read
jarvis.study.write
jarvis.study.delete
jarvis.study.sync
jarvis.notes.read
jarvis.notes.write
jarvis.files.read
jarvis.files.write
```

Por padrão:

- leitura pode ser concedida;
- escrita exige autorização;
- exclusão deve ser ainda mais restrita.

Configuração inicial recomendada:

```text
JARVIS:
  READ: permitido
  CREATE: permitido somente mediante escopo
  UPDATE: permitido somente mediante escopo
  MOVE: permitido somente mediante escopo
  DELETE: desabilitado por padrão
  PERMANENT_DELETE: desabilitado
```

---

# 9. MÓDULOS PRINCIPAIS

## 9.1 Authentication

- login;
- cadastro;
- logout;
- recuperação de senha;
- sessão;
- proteção de rotas;
- gerenciamento de usuário.

## 9.2 Workspace

- criação;
- configuração;
- membros;
- permissões;
- preferências.

## 9.3 File Manager

- arquivos;
- pastas;
- subpastas;
- upload;
- download;
- renomear;
- mover;
- excluir;
- restaurar;
- favoritos;
- recentes;
- ordenação;
- filtros.

## 9.4 Search

- nome;
- extensão;
- pasta;
- data;
- tamanho;
- full-text futuro;
- busca semântica futura.

## 9.5 Storage

- upload;
- download;
- signed URLs;
- metadados;
- quotas;
- uso de armazenamento.

## 9.6 Trash

- soft delete;
- restauração;
- exclusão definitiva;
- limpeza futura automática.

## 9.7 Favorites

- favoritar;
- desfavoritar;
- listar favoritos.

## 9.8 Recent Files

Registrar acesso de forma eficiente sem gerar carga desnecessária.

## 9.9 Obsidian Integration

- import;
- export;
- Markdown;
- anexos;
- estrutura de pastas;
- links;
- sync;
- conflitos.

## 9.10 Study Layer

Preparar domínio para:

- concursos;
- disciplinas;
- assuntos;
- metas;
- sessões;
- revisões;
- progresso.

## 9.11 AI / Knowledge

Preparar para:

- extração de texto;
- chunking;
- embeddings;
- vector search;
- RAG;
- contexto de estudo.

## 9.12 JARVIS Integration

API/Tools para:

- buscar arquivos;
- ler documentos;
- listar pastas;
- pesquisar conhecimento;
- consultar estudos;
- criar notas;
- mover arquivos;
- criar pastas;
- consultar progresso.

---

# 10. ESTRUTURA DE DADOS

Criar migrations versionadas.

Entidades principais:

```text
profiles
workspaces
workspace_members
folders
files
file_versions
favorites
recent_files
trash_items
notes
sync_devices
sync_operations
integrations
audit_logs
plans
subscriptions
usage_counters
```

Preparar entidades futuras:

```text
subjects
topics
study_sessions
study_goals
reviews
embeddings
knowledge_chunks
ai_conversations
ai_tool_calls
```

Não implementar tudo no MVP apenas para preencher tabelas. Criar somente o que possuir finalidade real, mas documentar a evolução.

---

# 11. FOLDERS

Campos sugeridos:

```text
id
workspace_id
parent_id
name
path/materialized path se necessário
created_by
created_at
updated_at
deleted_at
```

Regras:

- `workspace_id` obrigatório;
- `parent_id` permite hierarquia;
- impedir ciclos;
- impedir nomes inválidos;
- controlar acesso via workspace;
- soft delete quando aplicável.

---

# 12. FILES

Campos sugeridos:

```text
id
workspace_id
folder_id
name
original_name
storage_path
mime_type
extension
size_bytes
checksum
created_by
updated_by
created_at
updated_at
deleted_at
```

Preparar:

```text
version
metadata JSONB
```

Não armazenar binário no PostgreSQL.

---

# 13. STORAGE

Estrutura conceitual:

```text
workspace/{workspace_id}/files/{file_id}/...
```

Nunca permitir que o usuário defina livremente o path final.

O backend deve gerar/validar o caminho.

Uploads devem considerar:

- arquivos pequenos;
- arquivos grandes;
- retomada quando suportada;
- progresso;
- cancelamento;
- falhas;
- retry;
- idempotência.

---

# 14. TIPOS DE ARQUIVO

Aceitar qualquer tipo de arquivo tecnicamente suportado pelo Storage, sujeito a:

- limite de tamanho;
- segurança;
- políticas de conteúdo;
- capacidade do plano.

Exemplos:

```text
PDF
DOC
DOCX
XLS
XLSX
PPT
PPTX
TXT
MD
CSV
ZIP
RAR
PNG
JPG
JPEG
WEBP
SVG
MP3
MP4
M4A
EPUB
etc.
```

A aplicação não precisa visualizar todos os formatos.

---

# 15. PREVIEW

Quando possível:

- PDF → preview;
- imagem → preview;
- vídeo → player;
- áudio → player;
- Markdown → renderização;
- texto → visualização.

Para formatos não suportados:

```text
Arquivo não possui preview.
[Baixar]
```

---

# 16. LIXEIRA

Excluir significa inicialmente:

```text
active → deleted
```

Não apagar imediatamente do Storage.

Fluxo:

```text
Arquivo
 ↓
Lixeira
 ↓
Restaurar
OU
Excluir definitivamente
```

Preparar política futura de retenção automática.

---

# 17. BUSCA

## V1

Busca por:

- nome;
- pasta;
- extensão;
- tipo;
- data.

## V2

Full-text search.

## V3

Busca semântica:

```text
query
 ↓
embedding
 ↓
vector search
 ↓
chunks
 ↓
context
 ↓
JARVIS
```

---

# 18. KNOWLEDGE LAYER

Criar uma abstração de conhecimento.

Conceito:

```text
Source
  ↓
Extractor
  ↓
Normalizer
  ↓
Chunker
  ↓
Embedding
  ↓
Index
```

Tipos de source:

```text
PDF
TXT
MD
DOCX
HTML
etc.
```

Não criar dependência obrigatória de um único fornecedor de IA.

---

# 19. RAG

Quando implementado:

```text
User question
    ↓
Intent
    ↓
Query rewrite
    ↓
Retrieval
    ↓
Permission filtering
    ↓
Context assembly
    ↓
LLM
    ↓
Answer
    ↓
Citations
```

Regra crítica:

> O mecanismo de retrieval deve aplicar autorização antes de devolver qualquer contexto ao modelo.

Nunca recuperar documento que o usuário/JARVIS não pode acessar.

---

# 20. JARVIS TOOL LAYER

Criar ferramentas bem definidas.

Exemplo:

```text
search_files
get_file
list_folder
search_notes
get_note
create_folder
create_note
move_file
rename_file
get_recent_files
get_favorites
get_study_progress
search_knowledge
```

Cada tool deve possuir:

- nome;
- descrição;
- schema de entrada;
- schema de saída;
- escopos necessários;
- validação;
- logs;
- timeout;
- tratamento de erro.

---

# 21. API

Versionar desde o início:

```text
/api/v1/
```

Exemplos:

```text
GET    /api/v1/files
GET    /api/v1/files/:id
POST   /api/v1/files
PATCH  /api/v1/files/:id
DELETE /api/v1/files/:id

GET    /api/v1/folders
POST   /api/v1/folders
PATCH  /api/v1/folders/:id
DELETE /api/v1/folders/:id

GET    /api/v1/search

GET    /api/v1/notes
POST   /api/v1/notes
PATCH  /api/v1/notes/:id

GET    /api/v1/knowledge/search

GET    /api/v1/study/progress

GET    /api/v1/jarvis/tools
```

Não criar endpoints indiscriminadamente. Manter contratos claros.

---

# 22. API PARA JARVIS

Criar uma camada específica:

```text
/api/v1/agent/
```

ou equivalente arquitetural.

Ela deve:

1. autenticar;
2. identificar o agente;
3. identificar usuário;
4. identificar workspace;
5. verificar escopo;
6. validar input;
7. executar domínio;
8. registrar auditoria;
9. retornar resposta estruturada.

---

# 23. AUDITORIA

Toda operação sensível deve poder ser auditada.

Campos:

```text
id
workspace_id
actor_type
actor_id
action
resource_type
resource_id
request_id
metadata
created_at
```

Exemplos:

```text
USER → UPLOAD_FILE
USER → DELETE_FILE
JARVIS → READ_FILE
JARVIS → CREATE_NOTE
JARVIS → MOVE_FILE
ADMIN → CHANGE_MEMBER_ROLE
```

---

# 24. OBSIDIAN

O Obsidian permanecerá no:

- PC;
- celular.

A integração deve ser modular.

Criar:

```text
Sync Engine
├── filesystem adapter
├── markdown adapter
├── attachment adapter
├── conflict resolver
└── sync state
```

## Import

```text
Obsidian Vault
 ↓
Import
 ↓
Study Vault
```

## Export

```text
Study Vault
 ↓
Export
 ↓
Obsidian Vault
```

## Sync futuro

```text
PC Obsidian
     ↕
Sync Engine
     ↕
Cloud
     ↕
Mobile Obsidian
```

Não prometer sincronização bidirecional automática no MVP sem implementar corretamente o mecanismo.

---

# 25. CONFLITOS

Nunca sobrescrever silenciosamente.

Estados:

```text
SYNCED
PENDING_UPLOAD
PENDING_DOWNLOAD
CONFLICT
DELETED
```

Conflito:

```text
PC version 5
Mobile version 6
      ↓
CONFLICT
      ↓
Resolver
```

Preparar estratégias:

- keep local;
- keep remote;
- create copy;
- merge para Markdown quando possível.

---

# 26. PWA

Implementar:

- manifest;
- ícones;
- favicon;
- splash;
- standalone;
- service worker;
- cache de assets;
- estratégia de atualização;
- instalação.

Offline deve ser tratado com honestidade.

O sistema poderá oferecer:

- UI offline;
- cache;
- arquivos selecionados offline futuramente.

Não fingir que todo Storage remoto estará disponível sem conexão.

---

# 27. INTERFACE

A interface deve ser:

- premium;
- limpa;
- rápida;
- profissional;
- consistente;
- responsiva;
- acessível;
- sem aparência genérica de template de IA.

Referências conceituais:

- Google Drive para gerenciamento de arquivos;
- Obsidian para conhecimento;
- Linear para precisão de UI;
- Notion para organização.

Não copiar interfaces ou identidade visual.

---

# 28. TELAS

## Públicas

```text
/
 /login
 /register
 /forgot-password
```

## Autenticadas

```text
/dashboard
/dashboard/files
/dashboard/favorites
/dashboard/recent
/dashboard/trash
/dashboard/search
/dashboard/settings
/dashboard/integrations
/dashboard/obsidian
/dashboard/study
/dashboard/ai
```

Preparar:

```text
/dashboard/workspace
/dashboard/members
/dashboard/billing
```

para SaaS.

---

# 29. DASHBOARD

Exibir:

- arquivos recentes;
- favoritos;
- pastas principais;
- uso de armazenamento;
- atividade recente;
- atalhos;
- status de sincronização;
- futuramente progresso de estudos.

---

# 30. DRAG AND DROP

Suportar:

- upload;
- mover arquivo para pasta;
- mover múltiplos arquivos.

Ter feedback visual claro.

---

# 31. MULTI-SELECTION

Permitir selecionar múltiplos arquivos:

```text
□ arquivo 1
□ arquivo 2
□ arquivo 3
```

Ações:

- mover;
- excluir;
- favoritar;
- download quando aplicável.

---

# 32. SEGURANÇA

Implementar:

- HTTPS;
- cookies seguros;
- sessão segura;
- RLS;
- authorization server-side;
- validação de input;
- sanitização;
- proteção contra path traversal;
- proteção contra IDOR;
- rate limiting onde necessário;
- CSRF conforme arquitetura;
- headers de segurança;
- proteção contra XSS;
- secrets somente em environment variables;
- nenhum secret no client bundle.

---

# 33. SUPABASE RLS

Toda tabela sensível deve ter política RLS.

Princípio:

```text
user
 ↓
workspace membership
 ↓
resource.workspace_id
```

Não utilizar somente:

```text
resource.user_id = auth.uid()
```

quando o domínio for baseado em workspace.

---

# 34. SECRETS

Nunca versionar:

```text
SUPABASE_SERVICE_ROLE_KEY
API_KEYS
LLM_KEYS
JWT secrets
WEBHOOK secrets
```

Usar:

```text
.env.local
Vercel Environment Variables
```

Manter `.env.example`.

---

# 35. AMBIENTES

Criar:

```text
development
staging
production
```

Cada ambiente deve possuir configuração independente.

Não usar banco de produção durante desenvolvimento.

---

# 36. GITHUB

Repository:

```text
study-vault
```

Estrutura:

```text
.github/
└── workflows/
    ├── ci.yml
    ├── test.yml
    └── deploy.yml
```

GitHub será responsável por:

- código;
- migrations;
- documentação;
- CI;
- issues;
- releases.

Não utilizar GitHub como Storage principal de arquivos de estudo.

---

# 37. CI/CD

Pipeline mínimo:

```text
Pull Request
 ↓
Install
 ↓
Lint
 ↓
Typecheck
 ↓
Unit tests
 ↓
Integration tests
 ↓
Build
 ↓
E2E quando aplicável
 ↓
Merge
 ↓
Deploy
```

Não permitir merge com falhas críticas.

---

# 38. TESTES

## Unit

Testar:

- domínio;
- validações;
- parsers;
- permissions;
- sync;
- utilitários.

## Integration

Testar:

- Auth;
- Database;
- RLS;
- Storage;
- API.

## E2E

Testar fluxo real:

```text
Cadastro
 ↓
Login
 ↓
Workspace
 ↓
Criar pasta
 ↓
Upload
 ↓
Mover
 ↓
Favoritar
 ↓
Pesquisar
 ↓
Excluir
 ↓
Restaurar
 ↓
Logout
 ↓
Login
 ↓
Verificar persistência
```

## AI/JARVIS

Testar:

```text
Agent authentication
Tool authorization
Permission boundaries
Tool schema validation
Audit logs
Read operations
Write operations
Denied operations
```

---

# 39. TESTE DE SEGURANÇA CRÍTICO

Criar testes garantindo:

```text
Usuário A
    X
Usuário B
```

Usuário A não pode:

- acessar arquivo B;
- descobrir ID de arquivo B;
- baixar arquivo B;
- pesquisar conteúdo B;
- acessar nota B;
- manipular workspace B.

Testar também IDOR.

---

# 40. OBSERVABILIDADE

Preparar:

- structured logging;
- request ID;
- error tracking;
- performance metrics;
- upload metrics;
- sync metrics;
- AI tool metrics.

Logs nunca devem vazar:

- tokens;
- passwords;
- secrets;
- conteúdo privado desnecessário.

---

# 41. PERFORMANCE

Priorizar:

- Server Components quando apropriado;
- streaming quando útil;
- pagination;
- cursor pagination em grandes listas;
- lazy loading;
- virtualização para grandes diretórios;
- upload direto;
- cache;
- índices PostgreSQL;
- consultas seletivas.

Nunca carregar milhares de arquivos desnecessariamente.

---

# 42. PAGINAÇÃO

Todas as listas potencialmente grandes devem ser paginadas.

Exemplos:

- arquivos;
- busca;
- logs;
- atividades;
- versões.

---

# 43. STORAGE QUOTA

Preparar:

```text
workspace
 ↓
storage_usage
 ↓
plan.limit
```

Exemplo futuro:

```text
Free → 2 GB
Pro → 100 GB
Premium → 1 TB
```

Não implementar cobrança agora.

---

# 44. SAAS FUTURO

Arquitetura deve suportar:

```text
User
 ↓
Workspace
 ↓
Plan
 ↓
Subscription
 ↓
Usage
```

Futuro:

- Stripe/Kiwify;
- billing;
- upgrade;
- downgrade;
- cancelamento;
- limites;
- invoices;
- quotas.

---

# 45. IA FUTURA

Arquitetura preparada para:

```text
LLM Provider
 ↓
AI Gateway
 ↓
Prompt/Context
 ↓
Tools
 ↓
RAG
```

Nunca acoplar o domínio a uma API específica de LLM.

---

# 46. JARVIS — CASOS DE USO

O sistema deverá futuramente permitir:

### Busca

> "JARVIS, encontre meus materiais sobre controle de constitucionalidade."

### Resumo

> "JARVIS, resuma esse PDF."

### Organização

> "Coloque esse arquivo em Direito Constitucional."

### Criação

> "Crie uma nota sobre esse material."

### Estudo

> "Crie 20 questões com base nos meus materiais."

### Planejamento

> "Quais assuntos devo revisar esta semana?"

### Análise

> "Quais temas de Direito Administrativo ainda não estudei?"

### Conhecimento

> "Explique esse assunto usando apenas meus materiais."

### Obsidian

> "Transforme esse resumo em uma nota Markdown para meu Vault."

Todas essas funções devem respeitar autorização e auditoria.

---

# 47. AI TOOL CONTRACT

Cada ferramenta deve seguir contrato estruturado.

Exemplo conceitual:

```json
{
  "name": "search_files",
  "description": "Search files accessible to the current workspace",
  "input": {
    "query": "string",
    "folder_id": "string|null",
    "limit": "number"
  },
  "required_scope": "jarvis.files.read"
}
```

Saída:

```json
{
  "items": [],
  "total": 0,
  "request_id": "..."
}
```

Nunca retornar dados além do escopo permitido.

---

# 48. IDEMPOTÊNCIA

Operações sensíveis do agente devem ser idempotentes quando possível.

Exemplo:

```text
create_folder
```

Evitar criação duplicada em retry.

Usar:

- idempotency key;
- request ID;
- operação registrada.

---

# 49. RATE LIMITING

Preparar limites para:

- login;
- upload;
- download;
- search;
- API;
- AI tools;
- sync.

No SaaS:

```text
per user
per workspace
per API key
per IP
```

---

# 50. API KEYS / AGENTS

No futuro, JARVIS poderá utilizar credencial própria.

Modelar conceito:

```text
agent_credentials
agent_scopes
agent_sessions
```

Não implementar secret management improvisado.

Tokens devem:

- ser armazenados com segurança;
- possuir escopo;
- poder ser revogados;
- possuir data de criação;
- possuir último uso;
- possuir nome amigável.

---

# 51. VERSIONAMENTO

Usar:

```text
Semantic Versioning
```

Exemplo:

```text
v0.1.0
v0.2.0
v1.0.0
```

Releases devem possuir:

- changelog;
- migration notes;
- known issues;
- rollback considerations.

---

# 52. DOCUMENTAÇÃO

O repositório deverá conter:

```text
README.md
ARCHITECTURE.md
SECURITY.md
CONTRIBUTING.md
CHANGELOG.md
```

E:

```text
docs/
├── MASTER_ARCHITECTURE.md
├── PRODUCT_REQUIREMENTS.md
├── DATABASE_ARCHITECTURE.md
├── STORAGE_ARCHITECTURE.md
├── API_ARCHITECTURE.md
├── AI_INTEGRATION.md
├── JARVIS_INTEGRATION.md
├── RAG_ARCHITECTURE.md
├── OBSIDIAN_SYNC.md
├── PWA_ARCHITECTURE.md
├── SECURITY_ARCHITECTURE.md
├── MULTI_TENANCY.md
├── AUTHORIZATION.md
├── AUDIT_LOGGING.md
├── TEST_STRATEGY.md
└── SAAS_ROADMAP.md
```

---

# 53. DOCUMENTAÇÃO COMO SOURCE OF TRUTH

Antes de implementar uma mudança arquitetural:

1. analisar documentação;
2. identificar impacto;
3. atualizar documentação;
4. implementar;
5. testar;
6. registrar decisão quando relevante.

Criar ADRs para decisões arquiteturais importantes:

```text
docs/adr/
```

Exemplo:

```text
ADR-001-multi-tenancy.md
ADR-002-storage-strategy.md
ADR-003-jarvis-api.md
ADR-004-obsidian-sync.md
ADR-005-rag-strategy.md
```

---

# 54. FLUXO DE DESENVOLVIMENTO

Claude deve seguir esta sequência.

## Fase 0 — Discovery

Antes de codificar:

- analisar requisitos;
- identificar ambiguidades;
- propor decisões;
- documentar arquitetura;
- definir domínio.

## Fase 1 — Foundation

- repository;
- Next.js;
- TypeScript;
- lint;
- formatting;
- testing;
- environment;
- CI.

## Fase 2 — Infrastructure

- Supabase;
- Auth;
- database;
- migrations;
- RLS;
- Storage.

## Fase 3 — Domain

- workspace;
- folders;
- files;
- favorites;
- recent;
- trash.

## Fase 4 — UI

- dashboard;
- file manager;
- upload;
- search;
- settings.

## Fase 5 — PWA

- manifest;
- service worker;
- install;
- cache.

## Fase 6 — Obsidian

- import;
- export;
- sync foundation.

## Fase 7 — JARVIS

- API;
- authentication;
- tools;
- permissions;
- audit.

## Fase 8 — Knowledge

- extraction;
- indexing;
- full text;
- RAG foundation.

## Fase 9 — Hardening

- security;
- performance;
- E2E;
- accessibility;
- observability.

## Fase 10 — SaaS readiness

- plans;
- quotas;
- subscription abstraction;
- billing abstraction;
- tenant management.

---

# 55. REGRA PARA CLAUDE DURANTE IMPLEMENTAÇÃO

Claude deve:

- primeiro entender;
- depois planejar;
- depois implementar;
- depois testar;
- depois revisar;
- depois documentar.

Não executar mudanças massivas sem verificar dependências.

Quando uma tarefa for grande, dividir em etapas pequenas.

Após cada etapa:

```text
Implementation
 ↓
Tests
 ↓
Review
 ↓
Documentation
 ↓
Next phase
```

---

# 56. PROIBIÇÕES

Não fazer:

- hardcode de secrets;
- acesso direto do cliente a operações privilegiadas;
- service role key no browser;
- SQL sem validação quando houver entrada do usuário;
- confiar em IDs enviados pelo cliente;
- ignorar RLS;
- usar GitHub como Storage de arquivos de usuário;
- criar sincronização Obsidian falsa;
- implementar IA sem autorização;
- apagar arquivos definitivamente sem confirmação;
- misturar lógica de domínio com componentes React;
- criar endpoints sem contrato;
- instalar dependências sem necessidade;
- adicionar bibliotecas apenas por conveniência;
- criar código duplicado;
- deixar TODO crítico sem rastreamento.

---

# 57. CRITÉRIOS DE QUALIDADE

Uma funcionalidade só está pronta quando:

- funciona;
- está tipada;
- possui validação;
- possui tratamento de erro;
- possui autorização;
- possui testes relevantes;
- não quebra funcionalidades existentes;
- possui documentação quando necessário;
- possui UX adequada;
- é acessível;
- está preparada para observabilidade.

---

# 58. MVP

O MVP deve conter:

### Auth

- cadastro;
- login;
- logout;
- recuperação de senha.

### Workspace

- workspace pessoal;
- estrutura multi-tenant.

### File Manager

- criar pasta;
- subpasta;
- upload;
- download;
- renomear;
- mover;
- excluir;
- restaurar;
- favoritos;
- recentes;
- busca;
- filtros.

### Storage

- Supabase Storage;
- signed URLs;
- metadata;
- quota foundation.

### PWA

- instalação;
- ícone;
- manifest;
- cache básico.

### Segurança

- RLS;
- authorization;
- audit básico.

### API

- `/api/v1`;
- contratos documentados.

### JARVIS Foundation

- autenticação de agente;
- scopes;
- tools de leitura;
- audit.

### Obsidian Foundation

- Markdown import/export;
- arquitetura de sync documentada.

---

# 59. NÃO FAZER NO MVP

Não implementar inicialmente:

- billing;
- planos pagos;
- marketplace;
- equipe complexa;
- IA generativa completa;
- RAG completo;
- OCR avançado;
- sincronização bidirecional perfeita do Obsidian;
- colaboração em tempo real;
- edição online de todos os formatos.

Esses recursos devem estar previstos arquiteturalmente, mas não devem atrasar o núcleo.

---

# 60. ROADMAP PÓS-MVP

## V1.1

- UX refinement;
- performance;
- preview avançado;
- melhor busca;
- offline selecionado.

## V1.2

- Obsidian Sync;
- device management;
- conflict resolution.

## V1.3

- full-text indexing;
- document extraction.

## V1.4

- embeddings;
- semantic search;
- RAG.

## V2

- JARVIS completo;
- study assistant;
- question generation;
- summaries;
- revision planning.

## V3

- SaaS;
- subscriptions;
- quotas;
- teams;
- sharing;
- billing.

---

# 61. CRITÉRIO DE ACEITE FINAL DO MVP

O produto será considerado MVP somente quando:

1. Usuário consegue criar conta.
2. Usuário consegue entrar de outro dispositivo.
3. Usuário possui workspace.
4. Usuário consegue criar estrutura de pastas.
5. Usuário consegue enviar arquivos.
6. Arquivos permanecem disponíveis após logout.
7. Arquivos podem ser baixados.
8. Arquivos podem ser movidos.
9. Arquivos podem ser renomeados.
10. Arquivos podem ser favoritados.
11. Arquivos podem ser excluídos.
12. Arquivos podem ser restaurados.
13. Busca funciona.
14. RLS impede acesso indevido.
15. PWA instala corretamente.
16. CI passa.
17. E2E principal passa.
18. JARVIS consegue autenticar via camada apropriada.
19. JARVIS consegue pesquisar arquivos respeitando permissões.
20. Todas as operações do JARVIS são auditáveis.
21. Não existem secrets expostos.
22. Documentação está atualizada.

---

# 62. PRIMEIRA TAREFA DE CLAUDE

Antes de criar funcionalidades:

### Etapa A

Analise este documento inteiro.

### Etapa B

Faça uma auditoria técnica dos requisitos.

Identifique:

- ambiguidades;
- riscos;
- dependências;
- decisões que precisam ser tomadas;
- requisitos potencialmente conflitantes.

### Etapa C

Proponha a arquitetura detalhada.

### Etapa D

Crie/atualize a documentação:

```text
docs/
```

### Etapa E

Crie a base do projeto.

### Etapa F

Configure:

- TypeScript;
- lint;
- formatting;
- testes;
- GitHub;
- CI;
- environment;
- Supabase;
- migrations.

### Etapa G

Somente depois iniciar o domínio.

---

# 63. MODO DE TRABALHO OBRIGATÓRIO DO CLAUDE

Você não está sendo solicitado a criar apenas uma interface bonita.

Você está construindo um produto de software real.

Portanto:

> **Pense como arquiteto antes de pensar como programador.**

Sempre que existir uma decisão relevante:

1. explique a decisão;
2. apresente alternativas;
3. escolha a opção tecnicamente mais adequada;
4. registre a decisão;
5. implemente;
6. teste.

Não priorize velocidade de geração de código em detrimento de arquitetura.

---

# 64. RESULTADO ESPERADO

Ao final da primeira grande fase, o projeto deverá possuir:

```text
Study Vault
│
├── Web Application
├── PWA
├── Authentication
├── Multi-tenant foundation
├── PostgreSQL
├── Secure Storage
├── File Manager
├── Search
├── Trash
├── Favorites
├── Audit
├── API v1
├── JARVIS Tool Layer
├── Obsidian Integration Foundation
├── Test Suite
├── CI/CD
├── Documentation
└── SaaS-ready architecture
```

---

# 65. VISÃO DE LONGO PRAZO

A arquitetura final deverá permitir chegar a:

```text
                         ┌──────────────────────┐
                         │        JARVIS        │
                         │   Personal AI Agent  │
                         └──────────┬───────────┘
                                    │
                       ┌────────────▼────────────┐
                       │     AI / Agent Layer    │
                       └────────────┬────────────┘
                                    │
          ┌─────────────────────────┼──────────────────────────┐
          │                         │                          │
          ▼                         ▼                          ▼
      Knowledge                  Files                     Studies
       /RAG                        │                          │
          │                        │                          │
          └────────────────────────┼──────────────────────────┘
                                   │
                         ┌─────────▼─────────┐
                         │    STUDY VAULT    │
                         └─────────┬─────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                 │
                 ▼                 ▼                 ▼
             Obsidian          Storage           Database
             PC/Mobile        Cloud Files       PostgreSQL

                                   │
                         ┌─────────▼─────────┐
                         │       SaaS        │
                         │                   │
                         │ Users             │
                         │ Workspaces        │
                         │ Teams             │
                         │ Plans             │
                         │ Billing           │
                         └───────────────────┘
```

## PRINCÍPIO FINAL

**O Study Vault deve ser construído como uma plataforma de infraestrutura pessoal de conhecimento e estudos, e não como um simples gerenciador de arquivos.**

O MVP deve permanecer enxuto, mas a arquitetura deve ser suficientemente sólida para suportar:

- armazenamento;
- conhecimento;
- Obsidian;
- JARVIS;
- IA;
- estudos;
- múltiplos usuários;
- SaaS.

**Comece pela arquitetura e pela fundação. Não pule diretamente para a UI.**
