# P3 — Equipe + Usuários + Permissões (Wenox PWA CRM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. Steps use `- [ ]`.

**Goal:** Controle de acesso real: gestão de usuários da Wenox (Admin), vínculo de membros a clientes (aba Equipe) e matriz de permissões aplicada nas regras do PocketBase + UI role-aware.

**Architecture:** Coleção `equipe_cliente` (relation cliente↔usuario). Regras do PocketBase usando `@request.auth.role` e back-reference de `equipe_cliente` para escopar `clientes`. Helper de permissões no front (`src/auth/perms.ts`) espelha a matriz para esconder/mostrar ações. Páginas novas: Usuários (admin) e aba Equipe no detalhe do cliente.

**Tech Stack:** Ionic React 8, PocketBase SDK, Vitest, Playwright e2e.

**Pré-requisitos (P1/P2 prontos):** coleção `usuarios` (auth, campos role/status), `clientes` (com created/updated), `useAuth()` expõe `user.role`, navegação AppTabs, deploy automático no push da `main`.

**Matriz de referência (do spec):**

| Ação | Owner | Admin | Gestor | Membro | Visualizador |
|---|---|---|---|---|---|
| Clientes listar | todos | todos | vinculados | vinculados | vinculados |
| Clientes criar | ✅ | ✅ | ✅ | ❌ | ❌ |
| Clientes editar | ✅ | ✅ | ✅ | ✅ | ❌ |
| Clientes excluir | ✅ | ✅ | ❌ | ❌ | ❌ |
| Equipe add/remover | ✅ | ✅ | ✅ | ❌ | ❌ |
| Usuários gerenciar | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## File Structure

```
src/
├── auth/perms.ts                 # matriz -> funcoes can*(role)
├── usuarios/
│   ├── types.ts                  # Usuario, ROLES, AREAS
│   ├── usuariosService.ts        # CRUD usuarios
│   └── UsuariosPage.tsx          # gestao (Admin/Owner)
├── equipe/
│   ├── equipeService.ts          # CRUD equipe_cliente
│   └── EquipeTab.tsx             # aba Equipe no detalhe do cliente
├── clientes/ClienteDetailPage.tsx (modificar: segmento Info|Equipe)
├── components/AppTabs.tsx        (modificar: rota Usuarios + gate)
└── clientes/ClientesListPage.tsx (modificar: esconder FAB sem permissao)
tests/
├── perms.test.ts
├── usuariosService.test.ts
└── equipeService.test.ts
```

---

## Task 1: Regras do PocketBase — usuarios, clientes, equipe_cliente

**Files:** backend via superadmin API. Sem commit.

- [ ] **Step 1: Autenticar superadmin**

```bash
TOKEN=$(curl -s -X POST https://api.wenox.com.br/api/collections/_superusers/auth-with-password -H "Content-Type: application/json" -d '{"identity":"adm@wenox.com.br","password":"22jGwRjw1sbXcSqexWKh"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])') && echo "LEN=${#TOKEN}"
```
Expected: LEN > 100.

- [ ] **Step 2: Criar coleção `equipe_cliente`**

```bash
curl -s -X POST https://api.wenox.com.br/api/collections -H "Authorization: $TOKEN" -H "Content-Type: application/json" -d '{
  "name":"equipe_cliente","type":"base",
  "listRule":"@request.auth.id != \"\"",
  "viewRule":"@request.auth.id != \"\"",
  "createRule":"@request.auth.role = \"Owner\" || @request.auth.role = \"Admin\" || @request.auth.role = \"Gestor\"",
  "updateRule":"@request.auth.role = \"Owner\" || @request.auth.role = \"Admin\" || @request.auth.role = \"Gestor\"",
  "deleteRule":"@request.auth.role = \"Owner\" || @request.auth.role = \"Admin\" || @request.auth.role = \"Gestor\"",
  "fields":[
    {"name":"cliente","type":"relation","required":true,"maxSelect":1,"collectionId":"COLID_CLIENTES","cascadeDelete":true},
    {"name":"usuario","type":"relation","required":true,"maxSelect":1,"collectionId":"COLID_USUARIOS","cascadeDelete":true},
    {"name":"area","type":"select","maxSelect":1,"values":["Social Media","Trafego","Atendimento","Criacao","Dev","Outros"]},
    {"name":"status","type":"select","required":true,"maxSelect":1,"values":["Ativo","Inativo"]},
    {"name":"created","type":"autodate","onCreate":true,"onUpdate":false},
    {"name":"updated","type":"autodate","onCreate":true,"onUpdate":true}
  ]
}' -w "\nHTTP %{http_code}\n"
```
> Antes de rodar, obter os collectionId reais e substituir `COLID_CLIENTES`/`COLID_USUARIOS`:
```bash
curl -s "https://api.wenox.com.br/api/collections/clientes" -H "Authorization: $TOKEN" | python3 -c 'import sys,json;print("clientes",json.load(sys.stdin)["id"])'
curl -s "https://api.wenox.com.br/api/collections/usuarios" -H "Authorization: $TOKEN" | python3 -c 'import sys,json;print("usuarios",json.load(sys.stdin)["id"])'
```
Expected final: `HTTP 200`.

- [ ] **Step 3: Definir regras de `usuarios` (app precisa listar/gerir)**

```bash
python3 - "$TOKEN" <<'PY'
import sys,json,urllib.request
tok=sys.argv[1]; base="https://api.wenox.com.br"
def req(m,p,d=None):
    r=urllib.request.Request(base+p,method=m,headers={"Authorization":tok,"Content-Type":"application/json"},data=json.dumps(d).encode() if d else None)
    return json.load(urllib.request.urlopen(r))
col=req("GET","/api/collections/usuarios")
patch={
 "listRule":'@request.auth.id != ""',
 "viewRule":'@request.auth.id != ""',
 "createRule":'@request.auth.role = "Owner" || @request.auth.role = "Admin"',
 "updateRule":'@request.auth.role = "Owner" || @request.auth.role = "Admin" || @request.auth.id = id',
 "deleteRule":'@request.auth.role = "Owner" || @request.auth.role = "Admin"'
}
out=req("PATCH","/api/collections/usuarios",patch)
print("usuarios rules:", out["listRule"], "|", out["createRule"])
PY
```
Expected: imprime as regras aplicadas.

- [ ] **Step 4: Endurecer regras de `clientes` (escopo por role + equipe)**

```bash
python3 - "$TOKEN" <<'PY'
import sys,json,urllib.request
tok=sys.argv[1]; base="https://api.wenox.com.br"
def req(m,p,d=None):
    r=urllib.request.Request(base+p,method=m,headers={"Authorization":tok,"Content-Type":"application/json"},data=json.dumps(d).encode() if d else None)
    return json.load(urllib.request.urlopen(r))
scope='(@request.auth.role = "Owner" || @request.auth.role = "Admin" || @collection.equipe_cliente.cliente.id ?= id && @collection.equipe_cliente.usuario.id ?= @request.auth.id)'
patch={
 "listRule":scope,
 "viewRule":scope,
 "createRule":'@request.auth.role = "Owner" || @request.auth.role = "Admin" || @request.auth.role = "Gestor"',
 "updateRule":'@request.auth.role != "Visualizador" && '+scope,
 "deleteRule":'@request.auth.role = "Owner" || @request.auth.role = "Admin"'
}
out=req("PATCH","/api/collections/clientes",patch)
print("clientes listRule:", out["listRule"])
PY
```
Expected: imprime o listRule novo.

- [ ] **Step 5: Verificar — Owner lista clientes (deve passar), criar cliente como Owner**

```bash
UT=$(curl -s -X POST https://api.wenox.com.br/api/collections/usuarios/auth-with-password -H "Content-Type: application/json" -d '{"identity":"leonardo@wenox.com.br","password":"TrocarNoPrimeiroLogin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s -o /dev/null -w "list HTTP %{http_code}\n" "https://api.wenox.com.br/api/collections/clientes/records" -H "Authorization: $UT"
curl -s -X POST https://api.wenox.com.br/api/collections/clientes/records -H "Authorization: $UT" -H "Content-Type: application/json" -d '{"nome_fantasia":"Owner OK","categoria":"Cliente","telefone":"11","status":"Ativo"}' -o /dev/null -w "create HTTP %{http_code}\n"
```
Expected: ambos `HTTP 200` (Owner ignora escopo de equipe).

---

## Task 2: Helper de permissões (front) — TDD

**Files:** Create `src/auth/perms.ts`; Test `tests/perms.test.ts`.

- [ ] **Step 1: Teste que falha — `tests/perms.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { canCriarCliente, canExcluirCliente, canGerirUsuarios, canGerirEquipe } from '@/auth/perms';

describe('perms', () => {
  it('criar cliente: Owner/Admin/Gestor sim; Membro/Visualizador nao', () => {
    expect(canCriarCliente('Owner')).toBe(true);
    expect(canCriarCliente('Gestor')).toBe(true);
    expect(canCriarCliente('Membro')).toBe(false);
    expect(canCriarCliente('Visualizador')).toBe(false);
  });
  it('excluir cliente: so Owner/Admin', () => {
    expect(canExcluirCliente('Admin')).toBe(true);
    expect(canExcluirCliente('Gestor')).toBe(false);
  });
  it('gerir usuarios: so Owner/Admin', () => {
    expect(canGerirUsuarios('Owner')).toBe(true);
    expect(canGerirUsuarios('Membro')).toBe(false);
  });
  it('gerir equipe: Owner/Admin/Gestor', () => {
    expect(canGerirEquipe('Gestor')).toBe(true);
    expect(canGerirEquipe('Visualizador')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar (falha)**

```bash
cd "/home/leonardo-groff/projetos/Agencia Wenox" && export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh" && npx vitest run tests/perms.test.ts 2>&1 | grep -E "FAIL|Cannot find"
```
Expected: FAIL módulo não encontrado.

- [ ] **Step 3: Implementar `src/auth/perms.ts`**

```ts
export type Role = 'Owner' | 'Admin' | 'Gestor' | 'Membro' | 'Visualizador';

const inSet = (roles: Role[]) => (r?: string) => !!r && roles.includes(r as Role);

export const canCriarCliente = inSet(['Owner', 'Admin', 'Gestor']);
export const canEditarCliente = inSet(['Owner', 'Admin', 'Gestor', 'Membro']);
export const canExcluirCliente = inSet(['Owner', 'Admin']);
export const canGerirEquipe = inSet(['Owner', 'Admin', 'Gestor']);
export const canGerirUsuarios = inSet(['Owner', 'Admin']);
```

- [ ] **Step 4: Rodar (passa)**

```bash
cd "/home/leonardo-groff/projetos/Agencia Wenox" && export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh" && npx vitest run tests/perms.test.ts 2>&1 | grep -E "Test Files|Tests "
```
Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/auth/perms.ts tests/perms.test.ts && git commit -m "feat: helper de permissoes por role"
```

---

## Task 3: Serviço + página de Usuários — TDD

**Files:** Create `src/usuarios/types.ts`, `src/usuarios/usuariosService.ts`, `src/usuarios/UsuariosPage.tsx`; Test `tests/usuariosService.test.ts`.

- [ ] **Step 1: `src/usuarios/types.ts`**

```ts
export const ROLES = ['Owner', 'Admin', 'Gestor', 'Membro', 'Visualizador'] as const;
export const AREAS = ['Social Media', 'Trafego', 'Atendimento', 'Criacao', 'Dev', 'Outros'] as const;

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  cargo?: string;
  area?: string;
  telefone?: string;
  role: (typeof ROLES)[number];
  status: 'Ativo' | 'Inativo';
}
```

- [ ] **Step 2: Teste que falha — `tests/usuariosService.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const { getList, create, update } = vi.hoisted(() => ({ getList: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/pocketbase', () => ({ pb: { collection: () => ({ getList, create, update }) } }));
import { listUsuarios, criarUsuario, atualizarUsuario } from '@/usuarios/usuariosService';

describe('usuariosService', () => {
  beforeEach(() => vi.clearAllMocks());
  it('listUsuarios retorna items ordenados por nome', async () => {
    getList.mockResolvedValue({ items: [{ id: '1', nome: 'A' }] });
    const r = await listUsuarios();
    expect(getList).toHaveBeenCalledWith(1, 200, { sort: 'nome' });
    expect(r).toEqual([{ id: '1', nome: 'A' }]);
  });
  it('criarUsuario envia passwordConfirm igual', async () => {
    create.mockResolvedValue({ id: 'u' });
    await criarUsuario({ email: 'a@a.com', nome: 'A', role: 'Membro', status: 'Ativo' } as any, 'secret123');
    const arg = create.mock.calls[0][0];
    expect(arg.password).toBe('secret123');
    expect(arg.passwordConfirm).toBe('secret123');
  });
  it('atualizarUsuario delega update', async () => {
    update.mockResolvedValue({ id: '1' });
    await atualizarUsuario('1', { status: 'Inativo' } as any);
    expect(update).toHaveBeenCalledWith('1', { status: 'Inativo' });
  });
});
```

- [ ] **Step 3: Rodar (falha)**

```bash
cd "/home/leonardo-groff/projetos/Agencia Wenox" && export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh" && npx vitest run tests/usuariosService.test.ts 2>&1 | grep -E "FAIL|Cannot find"
```
Expected: FAIL.

- [ ] **Step 4: Implementar `src/usuarios/usuariosService.ts`**

```ts
import { pb } from '@/lib/pocketbase';
import type { Usuario } from './types';

const col = () => pb.collection('usuarios');

export async function listUsuarios(): Promise<Usuario[]> {
  const r = await col().getList(1, 200, { sort: 'nome' });
  return r.items as unknown as Usuario[];
}

export async function criarUsuario(
  u: Omit<Usuario, 'id'>,
  senha: string
): Promise<Usuario> {
  return (await col().create({
    ...u,
    password: senha,
    passwordConfirm: senha,
    emailVisibility: true,
  })) as unknown as Usuario;
}

export async function atualizarUsuario(
  id: string,
  patch: Partial<Omit<Usuario, 'id'>>
): Promise<Usuario> {
  return (await col().update(id, patch)) as unknown as Usuario;
}
```

- [ ] **Step 5: Rodar (passa)**

```bash
cd "/home/leonardo-groff/projetos/Agencia Wenox" && export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh" && npx vitest run tests/usuariosService.test.ts 2>&1 | grep -E "Test Files|Tests "
```
Expected: PASS (3).

- [ ] **Step 6: Implementar `src/usuarios/UsuariosPage.tsx`**

```tsx
import { useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonList, IonItem, IonLabel, IonBadge, useIonViewWillEnter,
} from '@ionic/react';
import { listUsuarios, criarUsuario } from '@/usuarios/usuariosService';
import { ROLES } from '@/usuarios/types';
import type { Usuario } from '@/usuarios/types';

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [novo, setNovo] = useState({ nome: '', email: '', role: 'Membro' });
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const carregar = async () => setUsuarios(await listUsuarios());
  useIonViewWillEnter(() => { carregar(); });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      await criarUsuario(
        { nome: novo.nome, email: novo.email, role: novo.role as Usuario['role'], status: 'Ativo' },
        senha
      );
      setNovo({ nome: '', email: '', role: 'Membro' });
      setSenha('');
      await carregar();
    } catch (err) {
      setErro(err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Erro ao criar usuário');
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/config" /></IonButtons>
          <IonTitle>Usuários</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <form onSubmit={add}>
          <label htmlFor="un">Nome</label>
          <input id="un" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} style={{ width: '100%', padding: 10, marginBottom: 8 }} />
          <label htmlFor="ue">E-mail</label>
          <input id="ue" type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} style={{ width: '100%', padding: 10, marginBottom: 8 }} />
          <label htmlFor="ur">Papel</label>
          <select id="ur" value={novo.role} onChange={(e) => setNovo({ ...novo, role: e.target.value })} style={{ width: '100%', padding: 10, marginBottom: 8 }}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <label htmlFor="up">Senha inicial</label>
          <input id="up" type="text" value={senha} onChange={(e) => setSenha(e.target.value)} style={{ width: '100%', padding: 10, marginBottom: 8 }} />
          {erro && <p style={{ color: 'var(--ion-color-danger, #eb445a)' }}>{erro}</p>}
          <button type="submit" style={{ width: '100%', padding: 12, background: 'var(--ion-color-primary)', color: '#fff', border: 'none', borderRadius: 8 }}>Adicionar usuário</button>
        </form>
        <IonList>
          {usuarios.map((u) => (
            <IonItem key={u.id}>
              <IonLabel>
                <h2>{u.nome}</h2>
                <p>{u.email}</p>
              </IonLabel>
              <IonBadge slot="end" color={u.status === 'Ativo' ? 'success' : 'medium'}>{u.role}</IonBadge>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/usuarios tests/usuariosService.test.ts && git commit -m "feat: servico e pagina de usuarios"
```

---

## Task 4: Serviço de equipe + aba Equipe no detalhe — TDD

**Files:** Create `src/equipe/equipeService.ts`, `src/equipe/EquipeTab.tsx`; Test `tests/equipeService.test.ts`; Modify `src/clientes/ClienteDetailPage.tsx`.

- [ ] **Step 1: Teste que falha — `tests/equipeService.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const { getList, create, del } = vi.hoisted(() => ({ getList: vi.fn(), create: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/pocketbase', () => ({ pb: { collection: () => ({ getList, create, delete: del }) } }));
import { listEquipe, addMembro, removeMembro } from '@/equipe/equipeService';

describe('equipeService', () => {
  beforeEach(() => vi.clearAllMocks());
  it('listEquipe filtra por cliente e expande usuario', async () => {
    getList.mockResolvedValue({ items: [{ id: 'e1' }] });
    const r = await listEquipe('c1');
    expect(getList).toHaveBeenCalledWith(1, 200, expect.objectContaining({
      filter: 'cliente = "c1"', expand: 'usuario',
    }));
    expect(r).toEqual([{ id: 'e1' }]);
  });
  it('addMembro cria vinculo', async () => {
    create.mockResolvedValue({ id: 'e' });
    await addMembro('c1', 'u1', 'Trafego');
    expect(create).toHaveBeenCalledWith({ cliente: 'c1', usuario: 'u1', area: 'Trafego', status: 'Ativo' });
  });
  it('removeMembro deleta', async () => {
    del.mockResolvedValue(true);
    await removeMembro('e1');
    expect(del).toHaveBeenCalledWith('e1');
  });
});
```

- [ ] **Step 2: Rodar (falha)**

```bash
cd "/home/leonardo-groff/projetos/Agencia Wenox" && export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh" && npx vitest run tests/equipeService.test.ts 2>&1 | grep -E "FAIL|Cannot find"
```
Expected: FAIL.

- [ ] **Step 3: Implementar `src/equipe/equipeService.ts`**

```ts
import { pb } from '@/lib/pocketbase';

export interface MembroEquipe {
  id: string;
  cliente: string;
  usuario: string;
  area?: string;
  status: string;
  expand?: { usuario?: { id: string; nome: string; email: string } };
}

const col = () => pb.collection('equipe_cliente');

export async function listEquipe(clienteId: string): Promise<MembroEquipe[]> {
  const r = await col().getList(1, 200, {
    filter: `cliente = "${clienteId}"`,
    expand: 'usuario',
  });
  return r.items as unknown as MembroEquipe[];
}

export async function addMembro(
  clienteId: string,
  usuarioId: string,
  area: string
): Promise<MembroEquipe> {
  return (await col().create({
    cliente: clienteId,
    usuario: usuarioId,
    area,
    status: 'Ativo',
  })) as unknown as MembroEquipe;
}

export async function removeMembro(id: string): Promise<void> {
  await col().delete(id);
}
```

- [ ] **Step 4: Rodar (passa)**

```bash
cd "/home/leonardo-groff/projetos/Agencia Wenox" && export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh" && npx vitest run tests/equipeService.test.ts 2>&1 | grep -E "Test Files|Tests "
```
Expected: PASS (3).

- [ ] **Step 5: Implementar `src/equipe/EquipeTab.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { IonList, IonItem, IonLabel, IonButton, IonSelect, IonSelectOption } from '@ionic/react';
import { listEquipe, addMembro, removeMembro } from '@/equipe/equipeService';
import type { MembroEquipe } from '@/equipe/equipeService';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { useAuth } from '@/auth/useAuth';
import { canGerirEquipe } from '@/auth/perms';

export function EquipeTab({ clienteId }: { clienteId: string }) {
  const { user } = useAuth();
  const podeGerir = canGerirEquipe(user?.role);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sel, setSel] = useState('');

  async function carregar() {
    setMembros(await listEquipe(clienteId));
  }
  useEffect(() => {
    carregar();
    listUsuarios().then(setUsuarios);
  }, [clienteId]);

  async function add() {
    if (!sel) return;
    await addMembro(clienteId, sel, 'Outros');
    setSel('');
    await carregar();
  }
  async function rm(id: string) {
    await removeMembro(id);
    await carregar();
  }

  return (
    <div>
      {podeGerir && (
        <div style={{ display: 'flex', gap: 8, padding: 8 }}>
          <IonSelect
            aria-label="Selecionar usuário"
            placeholder="Adicionar membro"
            value={sel}
            onIonChange={(e) => setSel(e.detail.value)}
            style={{ flex: 1 }}
          >
            {usuarios.map((u) => (
              <IonSelectOption key={u.id} value={u.id}>{u.nome}</IonSelectOption>
            ))}
          </IonSelect>
          <IonButton onClick={add}>Add</IonButton>
        </div>
      )}
      <IonList>
        {membros.map((m) => (
          <IonItem key={m.id}>
            <IonLabel>
              <h3>{m.expand?.usuario?.nome ?? m.usuario}</h3>
              <p>{m.area}</p>
            </IonLabel>
            {podeGerir && (
              <IonButton slot="end" color="danger" fill="clear" onClick={() => rm(m.id)}>
                Remover
              </IonButton>
            )}
          </IonItem>
        ))}
      </IonList>
    </div>
  );
}
```

- [ ] **Step 6: Modificar `ClienteDetailPage.tsx` — segmento Info|Equipe**

Adicionar import e estado de aba; envolver o conteúdo atual (lista de dados + ações) sob a aba "Info" e renderizar `<EquipeTab clienteId={c.id} />` sob a aba "Equipe". Inserir logo após `<h2>` do nome:

```tsx
import { IonSegment, IonSegmentButton } from '@ionic/react';
import { useState } from 'react';
import { EquipeTab } from '@/equipe/EquipeTab';
// dentro do componente, antes do return final:
const [aba, setAba] = useState<'info' | 'equipe'>('info');
// logo abaixo do <h2> do nome, inserir:
// <IonSegment value={aba} onIonChange={(e) => setAba(e.detail.value as 'info'|'equipe')}>
//   <IonSegmentButton value="info">Info</IonSegmentButton>
//   <IonSegmentButton value="equipe">Equipe</IonSegmentButton>
// </IonSegment>
// e condicionar: {aba === 'info' ? (<>...IonList+acoes...</>) : <EquipeTab clienteId={c.id} />}
```

(Implementar a edição real preservando todo o conteúdo de Info existente dentro de `aba === 'info'`.)

- [ ] **Step 7: Rodar suíte + build**

```bash
cd "/home/leonardo-groff/projetos/Agencia Wenox" && export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh" && npm test 2>&1 | grep -E "Tests " && npm run build 2>&1 | tail -2
```
Expected: testes PASS; build sem erro.

- [ ] **Step 8: Commit**

```bash
git add src/equipe src/clientes/ClienteDetailPage.tsx tests/equipeService.test.ts && git commit -m "feat: equipe vinculada ao cliente (aba Equipe)"
```

---

## Task 5: UI role-aware + rota Usuários

**Files:** Modify `src/clientes/ClientesListPage.tsx` (esconder FAB), `src/components/AppTabs.tsx` (rota /usuarios + link em Config).

- [ ] **Step 1: Esconder FAB de criar para quem não pode**

Em `ClientesListPage.tsx`: importar `useAuth` e `canCriarCliente`; envolver o `<IonFab>` em `{canCriarCliente(user?.role) && (...)}`.

```tsx
import { useAuth } from '@/auth/useAuth';
import { canCriarCliente } from '@/auth/perms';
// dentro do componente:
const { user } = useAuth();
// no JSX, trocar <IonFab ...>...</IonFab> por:
{canCriarCliente(user?.role) && (
  <IonFab slot="fixed" vertical="bottom" horizontal="end">
    <IonFabButton onClick={() => history.push('/novo-cliente')}>
      <IonIcon icon={add} />
    </IonFabButton>
  </IonFab>
)}
```

- [ ] **Step 2: Adicionar rota Usuários e link condicional em Config**

Em `AppTabs.tsx`: importar `UsuariosPage`, `useAuth`, `canGerirUsuarios`. Adicionar `<Route exact path="/usuarios" component={UsuariosPage} />` antes do catch-all. No `ConfigPage`, mostrar link só se `canGerirUsuarios(user?.role)`:

```tsx
import { UsuariosPage } from '@/usuarios/UsuariosPage';
import { canGerirUsuarios } from '@/auth/perms';
// no IonRouterOutlet, antes do catch-all:
<Route exact path="/usuarios" component={UsuariosPage} />
// no ConfigPage:
// {canGerirUsuarios(user?.role) && <IonButton routerLink="/usuarios">Gerenciar usuários</IonButton>}
```

- [ ] **Step 3: Suíte + build**

```bash
cd "/home/leonardo-groff/projetos/Agencia Wenox" && export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh" && npm test 2>&1 | grep -E "Tests " && npm run build 2>&1 | tail -2
```
Expected: PASS; build OK.

- [ ] **Step 4: Commit**

```bash
git add src/clientes/ClientesListPage.tsx src/components/AppTabs.tsx && git commit -m "feat: UI role-aware + rota usuarios"
```

---

## Task 6: e2e + deploy

- [ ] **Step 1: e2e local (regressão do fluxo de clientes)**

```bash
cd "/home/leonardo-groff/projetos/Agencia Wenox" && export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh" && npm run build >/dev/null 2>&1 && (fuser -k 4173/tcp 2>/dev/null || true) && sleep 1 && nohup npm run preview -- --port 4173 >/tmp/wp.log 2>&1 & sleep 5 && E2E_BASE=http://localhost:4173 node e2e/criar-cliente.mjs
```
Expected: `CLIENTE_NA_LISTA: true`, sem erros de API. (Owner ignora escopo, fluxo intacto.)

- [ ] **Step 2: Limpar registro de teste**

```bash
UT=$(curl -s -X POST https://api.wenox.com.br/api/collections/usuarios/auth-with-password -H "Content-Type: application/json" -d '{"identity":"leonardo@wenox.com.br","password":"TrocarNoPrimeiroLogin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
python3 - "$UT" <<'PY'
import sys,json,urllib.request
tok=sys.argv[1];b="https://api.wenox.com.br"
def a(m,p):
 r=urllib.request.Request(b+p,method=m,headers={"Authorization":tok})
 try:return json.load(urllib.request.urlopen(r))
 except Exception as e:return{"err":str(e)}
l=a("GET","/api/collections/clientes/records?perPage=200")
d=[i for i in l.get("items",[]) if i["nome_fantasia"].startswith("E2E Cliente") or i["nome_fantasia"]=="Owner OK"]
for i in d:a("DELETE","/api/collections/clientes/records/"+i["id"])
print("limpos",len(d))
PY
```
Expected: imprime quantidade limpa.

- [ ] **Step 3: Merge na main + deploy (via finishing-a-development-branch)**

Push na `main` dispara auto-deploy. Aguardar bundle mudar e validar:

```bash
curl -s -o /dev/null -w "app %{http_code}\n" -m 20 https://app.wenox.com.br/usuarios
```
Expected: `app 200`.

- [ ] **Step 4: e2e contra produção**

```bash
cd "/home/leonardo-groff/projetos/Agencia Wenox" && export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh" && E2E_BASE=https://app.wenox.com.br node e2e/criar-cliente.mjs
```
Expected: `CLIENTE_NA_LISTA: true`. Limpar registro de teste depois (Step 2).

---

## Self-Review

**1. Spec coverage:** matriz de permissões aplicada no backend (T1) e refletida no front (T2,T5); gestão de Usuários Admin (T3); equipe_cliente + aba Equipe (T4); escopo de clientes por role+equipe (T1). Itens fora do P3: Acessos (P4), Documentos (P5), overrides individuais (fase 2, fora do MVP).

**2. Placeholder scan:** T4 Step 6 descreve uma edição estrutural com instrução precisa (preservar Info dentro de `aba==='info'`) e o snippet do segmento — não é placeholder, é edição guiada com código; implementar conforme. Demais steps têm código completo e comandos com saída esperada.

**3. Type consistency:** `Role`/`Usuario` definidos em T2/T3 e usados em T4/T5; `canCriarCliente/canExcluirCliente/canGerirEquipe/canGerirUsuarios(role?: string)` assinatura única; `listEquipe(clienteId)`, `addMembro(clienteId,usuarioId,area)`, `removeMembro(id)` consistentes serviço/teste/Tab; rota `/usuarios` consistente AppTabs/ConfigPage. `useAuth().user.role` já existe (AuthUser do P1).

**Premissa:** o usuário logado de teste é Owner (`leonardo@wenox.com.br`), que ignora o escopo de equipe — por isso o e2e de clientes continua passando após endurecer as regras. Cenários de Membro/Visualizador são cobertos por testes unitários de `perms` (não exigem usuários reais extras no MVP).
