"""Testes de regressão do servidor do APP OBRA.

Rodam contra um PocketBase LOCAL e isolado (ver README.md), nunca contra
produção. Pré-requisito: empresas "Empresa A" (a@teste.local) e "Empresa B"
(b@teste.local) criadas pelo autocadastro, senha Senha12345.

Uso: python3 -I audit_tests.py resultado.json
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

B = os.environ.get("PB_URL", "http://127.0.0.1:8097")
SU_EMAIL = os.environ.get("PB_SUPERUSER_EMAIL", "audit@local.test")
SU_PASS = os.environ.get("PB_SUPERUSER_PASSWORD", "AuditPass123!")
results = []


# Foto de teste (JPEG 1x1) para os campos de foto obrigatória (foto_retirada).
FOTO = base64.b64decode("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=")


def call(method, path, token=None, body=None):
    req = urllib.request.Request(B + path, method=method)
    if token:
        req.add_header("Authorization", token)
    arquivos = {k: v for k, v in (body or {}).items() if isinstance(v, bytes)}
    if arquivos:  # multipart: campos em @jsonPayload + as fotos
        lim = "----auditoria" + uuid.uuid4().hex
        partes = [f'--{lim}\r\nContent-Disposition: form-data; name="@jsonPayload"\r\n\r\n'.encode()
                  + json.dumps({k: v for k, v in body.items() if k not in arquivos}).encode() + b"\r\n"]
        for k, v in arquivos.items():
            partes.append(f'--{lim}\r\nContent-Disposition: form-data; name="{k}"; filename="foto.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'.encode() + v + b"\r\n")
        data = b"".join(partes) + f"--{lim}--\r\n".encode()
        req.add_header("content-type", "multipart/form-data; boundary=" + lim)
    else:
        req.add_header("content-type", "application/json")
        data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt else {})
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, {"raw": txt}


def login(ident, pw="Senha12345"):
    s, r = call("POST", "/api/collections/users/auth-with-password", body={"identity": ident, "password": pw})
    assert s == 200, (ident, s, r)
    return r["token"], r["record"]


def check(grupo, name, ok, detail=""):
    results.append({"grupo": grupo, "teste": name, "ok": bool(ok), "detalhe": detail})
    print(("OK    " if ok else "FALHA ") + f"[{grupo}] {name}" + (f" | {detail}" if detail else ""))


def err(r):
    return (r.get("message", "") + " " + json.dumps(r.get("data") or {}, ensure_ascii=False))[:200]


def q(f):
    return urllib.parse.quote(f)


s, su = call("POST", "/api/collections/_superusers/auth-with-password", body={"identity": SU_EMAIL, "password": SU_PASS})
tSU = su.get("token")

tA, uA = login("a@teste.local")
tB, uB = login("b@teste.local")
cA, cB = uA["company_id"], uB["company_id"]
# As empresas A e B do teste criam muitos acessos: ficam sem os limites de empresa de teste
# (os limites são testados numa empresa à parte, no fim).
if tSU:
    for _c in (cA, cB):
        call("PATCH", f"/api/collections/companies/records/{_c}", tSU, {"limite_usuarios": 0, "limite_funcionarios": 0, "limite_materiais": 0, "limite_obras": 0})

# Funcionário comum da A (criado pelo admin, como na tela)
s, r = call("POST", "/api/collections/users/records", tA, {
    "email": "func@teste.local", "username": "funca", "password": "Senha12345", "passwordConfirm": "Senha12345",
    "company_id": cA, "role": "Funcionário", "cargo": "Funcionário", "status": "Ativo", "id_unico": "02", "name": "Func A"})
check("permissao", "Admin cria funcionário na própria empresa", s == 200, err(r) if s >= 400 else "")
tF, uF = login("func@teste.local")

# ------------------------------------------------------------------ isolamento
s, r = call("GET", "/api/collections/companies/records?perPage=50", tA)
names = [x["name"] for x in r.get("items", [])] if s == 200 else [f"erro {s}"]
check("isolamento", "Empresa só enxerga a si mesma em companies", names == ["Empresa A"], f"vê {names}")

s, r = call("GET", "/api/collections/users/records?perPage=50", tB)
check("isolamento", "Empresa B não lista usuários da A", s == 200 and "funca" not in json.dumps(r), f"status {s}, B vê {r.get('totalItems')} usuário(s)")
s, r = call("GET", "/api/collections/users/records?perPage=50", tA)
check("telas", "Admin A lista os usuários da própria empresa", s == 200 and r.get("totalItems", 0) >= 2, f"status {s}, {r.get('totalItems')}")
# A tela de login consulta o usuário pelo e-mail ANTES de autenticar; tem que
# voltar lista vazia (não erro), senão o login por e-mail quebra.
s, r = call("GET", "/api/collections/users/records?filter=" + q('email = "a@teste.local"'))
check("telas", "Login: consulta prévia por e-mail sem login não dá erro", s == 200, f"status {s}")
s, r = call("GET", "/api/collections/users/records?filter=" + q('password_reset_token ~ "a"'), tA)
check("permissao", "Ninguém busca usuários pelo token do convite", s >= 400, f"status {s}")

s, r = call("POST", "/api/collections/users/records", tA, {
    "email": "intruso@teste.local", "username": "intruso", "password": "Senha12345", "passwordConfirm": "Senha12345",
    "company_id": cB, "role": "Administrador", "cargo": "Administrador", "status": "Ativo", "id_unico": "99"})
check("isolamento", "Admin A não cria usuário dentro da empresa B", s >= 400, f"status {s}")

for col, body in [
    ("perdas_ganhos", {"tipo": "Quebra", "item_nome": "Betoneira A", "quantidade": 1, "status": "Registrado", "company_id": cA}),
    ("veiculos", {"id_unico": "V1", "placa": "AAA0A00", "marca": "Ford", "modelo": "Cargo", "company_id": cA}),
    ("contas_pagar", {"descricao": "Conta da A", "valor": 1000, "data_vencimento": "2026-11-01 12:00:00.000Z", "company_id": cA}),
    ("contas_receber", {"cliente": "Cliente A", "descricao": "Receber A", "valor": 500, "data_vencimento": "2026-11-01 12:00:00.000Z", "company_id": cA}),
    ("equipes", {"id_unico": "E1", "nome": "Equipe A", "company_id": cA}),
    ("documentos_central", {"nome": "Contrato A"}),  # tela não manda company_id
    ("qrcode_leituras", {"item_tipo": "Material", "usuario_id": uA["id"], "acao": "Leitura"}),  # idem
]:
    s, rec = call("POST", f"/api/collections/{col}/records", tA, body)
    check("telas", f"[{col}] Admin A cria registro (payload da tela)", s == 200, err(rec) if s >= 400 else "")
    if s >= 400:
        continue
    if "company_id" not in body:
        check("isolamento", f"[{col}] servidor preenche a empresa quando a tela não manda", rec.get("company_id") == cA)
    s, r = call("GET", f"/api/collections/{col}/records?perPage=50", tB)
    check("isolamento", f"[{col}] Empresa B não vê registros da A", s == 200 and r.get("totalItems", 0) == 0, f"status {s}, B vê {r.get('totalItems')}")
    s, r = call("DELETE", f"/api/collections/{col}/records/{rec['id']}", tB)
    check("isolamento", f"[{col}] Empresa B não apaga registro da A", s >= 400, f"status {s}")
    s, r = call("GET", f"/api/collections/{col}/records?perPage=50", tA)
    check("telas", f"[{col}] Empresa A continua vendo o próprio registro", s == 200 and r.get("totalItems", 0) >= 1, f"status {s}")

# ------------------------------------------------------------------ permissões
s, r = call("PATCH", f"/api/collections/users/records/{uF['id']}", tF, {"role": "Administrador", "cargo": "Administrador"})
check("permissao", "Funcionário não se promove a Administrador", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/users/records/{uF['id']}", tF, {"role": "admin"})
check("permissao", "Funcionário não se dá role=admin", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/users/records/{uF['id']}", tF, {"company_id": cB})
check("permissao", "Funcionário não se move para outra empresa", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/users/records/{uF['id']}", tF, {"telefone": "11999990000", "name": "Func A2"})
check("telas", "Funcionário altera o próprio telefone e nome", s == 200, err(r) if s >= 400 else "")
s, r = call("PATCH", f"/api/collections/users/records/{uF['id']}", tF,
            {"name": "Func A3", "role": "Funcionário", "cargo": "Funcionário", "status": "Ativo", "id_unico": "02"})
check("telas", "Perfil reenviando os mesmos cargo/status (como a tela faz) é aceito", s == 200, err(r) if s >= 400 else "")
if tSU:
    call("PATCH", f"/api/collections/users/records/{uF['id']}", tSU, {"role": ""})
    s, r = call("PATCH", f"/api/collections/users/records/{uF['id']}", tF, {"name": "Func A4", "role": "Funcionário", "status": "Ativo"})
    check("telas", "Usuário antigo com role vazio salva o perfil (tela manda role = cargo)", s == 200, err(r) if s >= 400 else "")
    call("PATCH", f"/api/collections/users/records/{uF['id']}", tSU, {"role": "Funcionário"})
s, r = call("PATCH", f"/api/collections/users/records/{uF['id']}", tA, {"cargo": "Almoxarife"})
check("permissao", "Admin muda o cargo de funcionário da própria empresa", s == 200 and r.get("cargo") == "Almoxarife", err(r) if s >= 400 else "")
call("PATCH", f"/api/collections/users/records/{uF['id']}", tA, {"cargo": "Funcionário"})

s, obraB = call("POST", "/api/collections/obras/records", tB, {"nome": "Obra secreta B", "company_id": cB})
check("telas", "Admin B cria obra", s == 200, err(obraB) if s >= 400 else "")
if tSU:
    call("PATCH", f"/api/collections/users/records/{uF['id']}", tSU, {"role": "admin"})
    tF2, _ = login("func@teste.local")
    s, r = call("DELETE", f"/api/collections/obras/records/{obraB.get('id')}", tF2)
    check("isolamento", "Mesmo com role=admin, usuário da A não apaga obra da B", s >= 400, f"status {s}")
    call("PATCH", f"/api/collections/users/records/{uF['id']}", tSU, {"role": "Funcionário"})

s, r = call("GET", f"/api/collections/users/records/{uF['id']}", tA)
check("permissao", "Token de convite não aparece para outros usuários", "password_reset_token" not in r, "")

s, r = call("PATCH", f"/api/collections/companies/records/{cA}", tA, {"phone": "1133334444"})
check("telas", "Admin edita os dados da própria empresa (Configurações)", s == 200, err(r) if s >= 400 else "")
s, r = call("PATCH", f"/api/collections/companies/records/{cB}", tA, {"phone": "0"})
check("isolamento", "Admin A não edita a empresa B", s >= 400, f"status {s}")

# ------------------------------------------------------------------ módulos (payloads das telas)
s, obra = call("POST", "/api/collections/obras/records", tA, {"nome": "Obra Teste A", "descricao": "", "status": "Planejamento", "company_id": cA})
check("telas", "Obras: criar", s == 200, err(obra) if s >= 400 else "")
s, forn = call("POST", "/api/collections/fornecedores/records", tA, {"nome": "Fornecedor A", "cnpj": "00000000000100", "company_id": cA})
check("telas", "Fornecedores: criar", s == 200, err(forn) if s >= 400 else "")
s, mats = call("GET", "/api/collections/materiais/records?perPage=1&filter=" + q(f'company_id="{cA}"'), tA)
check("telas", "Materiais: empresa nova começa com o estoque vazio", s == 200 and mats.get("totalItems", 0) == 0, f"{mats.get('totalItems')} materiais")
s, cat = call("GET", "/api/custom/catalogo-materiais", tA)
check("telas", "Materiais: lista de sugestões disponível para cadastrar", s == 200 and len(cat) >= 90, f"{len(cat) if isinstance(cat, list) else cat}")
s, cat2 = call("GET", "/api/custom/catalogo-materiais")
check("permissao", "Lista de sugestões exige login", s >= 400, f"status {s}")
s, mat = call("POST", "/api/collections/materiais/records", tA, {"name": "Cimento CP II 50kg", "code": "CON-001", "unit": "un",
              "category": "Materiais de Construção", "status": "active", "company_id": cA})
mat = mat if s == 200 else None
s, r = call("POST", "/api/collections/materiais/records", tA, {"name": "Cimento CP-II 50kg", "code": "TST-1", "unit": "un", "quantity_in_stock": 0, "status": "active", "company_id": cA})
check("telas", "Materiais: criar", s == 200, err(r) if s >= 400 else "")
s, r = call("POST", "/api/collections/compras/records", tA, {"numero": "C-1", "numero_compra": "C-1", "fornecedorId": forn.get("id"), "fornecedor_id": forn.get("id"),
            "descricao": "Compra teste", "valor": 100, "status": "Solicitado", "company_id": cA, "obra_id": obra.get("id")})
check("telas", "Compras: criar", s == 200, err(r) if s >= 400 else "")
s, r = call("POST", "/api/collections/epis/records", tA, {"id_unico": "EPI-1", "tipo": "Capacete", "status": "Ativo", "company_id": cA})
check("telas", "EPIs: criar", s == 200, err(r) if s >= 400 else "")
s, r = call("POST", "/api/collections/equipamentos/records", tA, {"code": "EQ-1", "name": "Betoneira", "status": "available", "company_id": cA})
check("telas", "Equipamentos: criar", s == 200, err(r) if s >= 400 else "")
s, r = call("POST", "/api/collections/financeiro/records", tA, {"obra_id": obra.get("id"), "type": "despesa", "description": "Diária", "amount": 150,
            "due_date": "2026-11-01 12:00:00.000Z", "status": "pendente", "company_id": cA})
check("telas", "Financeiro: Administrador lança", s == 200, err(r) if s >= 400 else "")

# ------------------------------------------------------------------ formulários exatos das telas
# Chaves copiadas do que as telas enviam (docs/auditoria/anexo-frontend.md §3).
s, f2 = call("POST", "/api/collections/fornecedores/records", tA, {"nome": "Fornecedor A2", "cnpj": "00000000000200", "company_id": cA})
check("telas", "Fornecedores: segundo fornecedor da empresa", s == 200, err(f2) if s >= 400 else f2.get("id_unico", ""))
s, fB = call("POST", "/api/collections/fornecedores/records", tB, {"nome": "Mesmo fornecedor", "cnpj": "00000000000100", "company_id": cB})
check("isolamento", "Outra empresa cadastra fornecedor com o mesmo CNPJ", s == 200, err(fB) if s >= 400 else fB.get("id_unico", ""))
for n in (1, 2):
    s, r = call("POST", "/api/collections/compras/records", tA, {
        "numero_compra": f"CMP-2026-000{n}", "company_id": cA, "fornecedor_id": forn.get("id"), "obra_id": obra.get("id"),
        "solicitante_id": uA["id"], "comprador_id": uA["id"], "categoria": "Material", "subcategoria": "", "centro_custo": "",
        "prioridade": "Normal", "justificativa": "", "observacoes": "", "descricao": f"Compra pela tela {n}",
        "data_solicitacao": "2026-10-18", "data_entrega_prevista": "", "data_entrega_real": "", "status": "Solicitado",
        "valor_previsto": 250, "valor_aprovado": 0, "valor_final": 0, "forma_pagamento": "Boleto", "parcelas": 1,
        "responsavel_aprovacao_id": "", "data_aprovacao": "", "criado_por": uA["id"], "atualizado_por": uA["id"]})
    check("telas", f"Compras: criar pela tela (compra {n})", s == 200, err(r) if s >= 400 else "")
for n in (1, 2):
    s, r = call("POST", "/api/collections/equipamentos/records", tA, {
        "numero_patrimonial": f"PAT-{n}", "codigo_interno": f"EQ-00{n}", "nome": f"Betoneira 400L {n}", "descricao": "",
        "categoria": "Máquinas", "marca": "CSM", "modelo": "", "fabricante": "", "numero_serie": "", "data_compra": "2026-01-10",
        "garantia": "12 meses", "vida_util": 5, "valor_compra": 3500, "valor_atual": 3000, "depreciacao": 500,
        "estado_conservacao": "Bom", "situacao": "Disponível", "local_atual": "Almoxarifado", "obra_atual_id": obra.get("id"),
        "responsavel_id": uA["id"], "centro_custo": "", "observacoes": "", "company_id": cA, "criado_por": uA["id"], "atualizado_por": uA["id"]})
    check("telas", f"Equipamentos: criar pela tela (equipamento {n})", s == 200 and r.get("nome") == f"Betoneira 400L {n}", err(r) if s >= 400 else "")
    if s == 200 and n == 1:
        s, r2 = call("PATCH", f"/api/collections/equipamentos/records/{r['id']}", tA, {"situacao": "Baixado", "motivo_baixa": "Quebrou", "obra_atual_id": None})
        check("telas", "Equipamentos: dar baixa", s == 200 and r2.get("situacao") == "Baixado", err(r2) if s >= 400 else "")
for n in (1, 2):
    s, r = call("POST", "/api/collections/epis/records", tA, {
        "codigo": f"EPI-CAP-{n}", "nome": "Capacete classe B", "descricao": "", "categoria": "Cabeça", "marca": "3M", "numero_ca": "12345",
        "validade_ca": "2028-01-01", "tamanho": "Único", "quantidade_estoque": 20, "estoque_minimo": 5, "unidade": "un",
        "valor_unitario": 35.5, "status": "Ativo", "tipo": "Capacete", "id_unico": f"EPI-1700000000-{n}", "company_id": cA, "criado_por": uA["id"]})
    check("telas", f"EPIs: criar pela tela (EPI {n}) guardando nome e estoque",
          s == 200 and r.get("nome") == "Capacete classe B" and r.get("quantidade_estoque") == 20, err(r) if s >= 400 else "")
for n in (1, 2):
    s, r = call("POST", "/api/collections/veiculos/records", tA, {"placa": f"ABC1D2{n}", "marca": "Fiat", "modelo": "Strada", "tipo": "Carro",
                                                                 "status": "Ativo", "company_id": cA, "id_unico": f"VEI-17000000{n}"})
    check("telas", f"Veículos: cadastrar sem chassi/RENAVAM (veículo {n})", s == 200, err(r) if s >= 400 else "")

# ------------------------------------------------------------------ solicitações
s, sol = call("POST", "/api/collections/solicitacoes/records", tA, {
    "company_id": cA, "numero_solicitacao": "SOL-T1", "tipo": "Material", "categoria": "Elétrica", "solicitante_id": uA["id"],
    "prioridade": "Normal", "descricao": "teste", "status": "Aberta", "data_solicitacao": "2026-10-18 12:00:00.000Z"})
check("telas", "Solicitações: Admin cria", s == 200, err(sol) if s >= 400 else "")
if s == 200:
    s, r = call("PATCH", f"/api/collections/solicitacoes/records/{sol['id']}", tA, {"status": "Aprovada", "responsavel_id": uA["id"]})
    check("telas", "Solicitações: Administrador aprova", s == 200, err(r) if s >= 400 else "")
s, solF = call("POST", "/api/collections/solicitacoes/records", tF, {
    "company_id": cA, "numero_solicitacao": "SOL-T2", "tipo": "Material", "solicitante_id": uF["id"], "descricao": "func", "status": "Aberta"})
check("telas", "Solicitações: Funcionário cria", s == 200, err(solF) if s >= 400 else "")
if s == 200:
    s, r = call("PATCH", f"/api/collections/solicitacoes/records/{solF['id']}", tF, {"status": "Aprovada"})
    check("permissao", "Solicitações: Funcionário não aprova a própria", s >= 400, f"status {s}")
    s, r = call("PATCH", f"/api/collections/solicitacoes/records/{solF['id']}", tF, {"descricao": "func corrigido"})
    check("telas", "Solicitações: Funcionário corrige a própria", s == 200, err(r) if s >= 400 else "")
    s, r = call("PATCH", f"/api/collections/solicitacoes/records/{solF['id']}", tF, {"status": "Cancelada", "observacoes": "[Cancelamento] engano"})
    check("telas", "Solicitações: Funcionário cancela a própria", s == 200, err(r) if s >= 400 else "")

# ------------------------------------------------------------------ estoque (Etapa 2)
def saldo(mid):
    return call("GET", f"/api/collections/materiais/records/{mid}", tA)[1].get("quantity_in_stock")


def mov(tipo, qtd, status="Aprovado", **extra):
    body = {"material_id": mid, "company_id": cA, "tipo": tipo, "quantidade": qtd, "status": status,
            "data": "2026-10-18", "obra_id": obra.get("id"), "criado_por": uA["id"]}
    body.update(extra)
    return call("POST", "/api/collections/movimentacoes/records", tA, body)


s, m = call("POST", "/api/collections/materiais/records", tA, {"name": "Areia média m3", "code": "TST-AREIA", "unit": "m3",
            "quantity_in_stock": 50, "min_quantity": 5, "unit_cost": 120, "status": "active", "company_id": cA})
check("estoque", "Material novo com saldo inicial 50", s == 200 and saldo(m.get("id")) == 50, err(m) if s >= 400 else f"saldo {saldo(m.get('id'))}")
mid = m.get("id")
s, r = call("GET", "/api/collections/movimentacoes/records?filter=" + q(f'material_id="{mid}"'), tA)
check("estoque", "Saldo inicial fica registrado como movimentação", r.get("totalItems") == 1)

s, e1 = mov("Entrada", 10)
check("estoque", "Entrada +10 muda o saldo pelo servidor (50 -> 60)", s == 200 and saldo(mid) == 60, err(e1) if s >= 400 else f"saldo {saldo(mid)}")
check("estoque", "Movimentação guarda saldo anterior e posterior", e1.get("saldo_anterior") == 50 and e1.get("saldo_posterior") == 60)

s, r = call("PATCH", f"/api/collections/materiais/records/{mid}", tA, {"quantity_in_stock": 60})
check("telas", "Tela Estoque sincronizando o saldo após a movimentação continua funcionando", s == 200 and saldo(mid) == 60)
s, r = call("PATCH", f"/api/collections/materiais/records/{mid}", tA, {"quantity_in_stock": 999, "name": "Areia média (m3)"})
check("estoque", "Editar o saldo direto no cadastro do material não muda o estoque", s == 200 and saldo(mid) == 60 and r.get("name") == "Areia média (m3)",
      f"saldo {saldo(mid)}")

s, r = mov("Saída", 999999)
check("estoque", "Servidor recusa Saída maior que o saldo", s >= 400 and saldo(mid) == 60, f"status {s} {r.get('message', '')[:80]}")
s, s20 = mov("Saída", 20, destino="Obra")
check("estoque", "Saída -20 (60 -> 40)", s == 200 and saldo(mid) == 40, err(s20) if s >= 400 else "")
s, r = mov("Retirada por Funcionário", 3, destino="Funcionário")
check("estoque", "Retirada por funcionário -3 (40 -> 37)", s == 200 and saldo(mid) == 37, err(r) if s >= 400 else "")
s, r = mov("Devolução de Funcionário", 3, origem="Funcionário")
check("estoque", "Devolução de funcionário +3 (37 -> 40)", s == 200 and saldo(mid) == 40, err(r) if s >= 400 else "")

s, p5 = mov("Consumo de Obra", 5, status="Pendente")
check("estoque", "Movimentação Pendente não mexe no saldo", s == 200 and saldo(mid) == 40)
s, r = call("PATCH", f"/api/collections/movimentacoes/records/{p5.get('id')}", tA, {"quantidade": 4})
check("telas", "Movimentação Pendente ainda pode ser corrigida", s == 200, err(r) if s >= 400 else "")
s, r = call("PATCH", f"/api/collections/movimentacoes/records/{p5.get('id')}", tA, {"status": "Aprovado"})
check("estoque", "Aprovar a Pendente lança no saldo (40 -> 36)", s == 200 and saldo(mid) == 36, err(r) if s >= 400 else f"saldo {saldo(mid)}")
s, r = call("PATCH", f"/api/collections/movimentacoes/records/{p5.get('id')}", tA, {"status": "Finalizado"})
check("estoque", "Finalizar não lança de novo (continua 36)", s == 200 and saldo(mid) == 36, err(r) if s >= 400 else "")

s, r = call("PATCH", f"/api/collections/movimentacoes/records/{e1.get('id')}", tA, {"quantidade": 1})
check("estoque", "Movimentação lançada não pode ser editada", s >= 400, f"status {s}")
s, r = call("DELETE", f"/api/collections/movimentacoes/records/{e1.get('id')}", tA)
check("estoque", "Movimentação lançada não pode ser excluída", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/movimentacoes/records/{s20.get('id')}", tA, {"status": "Cancelado", "motivo_cancelamento": "lançada errada"})
check("estoque", "Cancelar a saída de 20 estorna o saldo (36 -> 56)", s == 200 and saldo(mid) == 56, err(r) if s >= 400 else f"saldo {saldo(mid)}")
s, r = call("PATCH", f"/api/collections/movimentacoes/records/{s20.get('id')}", tA, {"status": "Aprovado"})
check("estoque", "Cancelada não pode ser reaprovada", s >= 400 and saldo(mid) == 56, f"status {s}")

s, r = mov("Transferência", 10, origem="Almoxarifado", destino="Obra 2")
check("estoque", "Transferência não muda o saldo", s == 200 and saldo(mid) == 56, err(r) if s >= 400 else "")
s, r = mov("Inventário", 30, observacoes="Contagem do mês")
check("divergencia", "Inventário com diferença sem motivo é recusado", s >= 400 and "motivo" in r.get("message", "") and saldo(mid) == 56, r.get("message", "")[:80])
s, inv = mov("Inventário", 30, observacoes="Contagem do mês", motivo_divergencia="Contagem diferente do sistema")
check("divergencia", "Ajuste autorizado grava saldo do sistema, diferença e quem autorizou", inv.get("saldo_sistema") == 56
      and inv.get("diferenca_contagem") == -26 and inv.get("autorizado_por") == uA["id"] and bool(inv.get("data_autorizacao")))
check("estoque", "Inventário: saldo passa a ser o contado (56 -> 30)", s == 200 and saldo(mid) == 30 and inv.get("quantidade_aplicada") == -26,
      err(inv) if s >= 400 else f"saldo {saldo(mid)} diferença {inv.get('quantidade_aplicada')}")
s, r = call("PATCH", f"/api/collections/movimentacoes/records/{e1.get('id')}", tA, {"status": "Cancelado", "motivo_cancelamento": "teste"})
check("estoque", "Cancelar a entrada de 10 com saldo 30 estorna (30 -> 20)", s == 200 and saldo(mid) == 20, err(r) if s >= 400 else "")

s, comp = call("POST", "/api/collections/compras/records", tA, {"numero_compra": "CMP-EST-1", "company_id": cA, "fornecedor_id": forn.get("id"),
               "descricao": "Areia para a obra", "status": "Aprovado", "valor_previsto": 840, "criado_por": uA["id"]})
s, it = call("POST", "/api/collections/compras_itens/records", tA, {"company_id": cA, "compra_id": comp.get("id"), "material_id": mid,
             "descricao": "Areia média", "unidade": "m3", "quantidade": 7, "preco_unitario": 120, "valor_total": 840, "criado_por": uA["id"]})
check("telas", "Compras: adicionar item", s == 200, err(it) if s >= 400 else "")
s, r = call("PATCH", f"/api/collections/compras/records/{comp.get('id')}", tA, {"status": "Recebido", "data_entrega_real": "2026-10-18"})
check("estoque", "Compra recebida entra no estoque (+7: 20 -> 27)", s == 200 and saldo(mid) == 27, err(r) if s >= 400 else f"saldo {saldo(mid)}")
s, r = call("PATCH", f"/api/collections/compras/records/{comp.get('id')}", tA, {"observacoes": "conferido"})
check("estoque", "Editar a compra recebida não lança de novo (continua 27)", s == 200 and saldo(mid) == 27)

# ------------------------------------------------------------------ divergência e quem aprova (Etapa 4.3)
def usuario(email, cargo_):
    call("POST", "/api/collections/users/records", tA, {"email": email, "username": email.split("@")[0].replace(".", ""), "password": "Senha12345",
         "passwordConfirm": "Senha12345", "company_id": cA, "cargo": cargo_, "role": cargo_, "status": "Ativo"})
    return login(email)[0]
tAlm = usuario("almox@teste.local", "Almoxarife")
tPed = usuario("pedreiro.div@teste.local", "Pedreiro")
tEng = usuario("eng.div@teste.local", "Engenheiro")
s0 = saldo(mid)
def movc(tok, tipo, qtd, status="Aprovado", **extra):
    body = {"material_id": mid, "company_id": cA, "tipo": tipo, "quantidade": qtd, "status": status, "data": "2026-10-18"}
    body.update(extra)
    return call("POST", "/api/collections/movimentacoes/records", tok, body)
s, r = movc(tPed, "Saída", 1)
check("divergencia", "Pedreiro não lança movimentação de estoque (só vê o próprio material)", s >= 400 and saldo(mid) == s0, f"status {s}")
s, r = movc(tAlm, "Saída", 1, status="Pendente")
check("divergencia", "Saída lançada como Pendente não mexe no saldo", s == 200 and r.get("status") == "Pendente" and saldo(mid) == s0,
      err(r) if s >= 400 else f"{r.get('status')} saldo {saldo(mid)}")
s, r2 = call("PATCH", f"/api/collections/movimentacoes/records/{r.get('id')}", tPed, {"status": "Aprovado"})
check("divergencia", "Pedreiro não aprova movimentação (servidor)", s >= 400 and saldo(mid) == s0, f"status {s}")
s, r2 = call("PATCH", f"/api/collections/movimentacoes/records/{r.get('id')}", tAlm, {"status": "Aprovado"})
check("divergencia", "Almoxarife aprova a saída normal", s == 200 and saldo(mid) == s0 - 1, err(r2) if s >= 400 else f"saldo {saldo(mid)}")
s0 = saldo(mid)
s, pz = movc(tAlm, "Inventário", s0 - 4, motivo_divergencia="Sumiço ou furto", observacoes="faltaram 4")
check("divergencia", "Contagem do almoxarife com diferença fica esperando autorização", s == 200 and pz.get("status") == "Pendente"
      and pz.get("diferenca_contagem") == -4 and saldo(mid) == s0, err(pz) if s >= 400 else f"{pz.get('status')} {pz.get('diferenca_contagem')}")
s, r = call("PATCH", f"/api/collections/movimentacoes/records/{pz.get('id')}", tAlm, {"status": "Aprovado"})
check("divergencia", "Almoxarife não autoriza a própria diferença", s == 403 and saldo(mid) == s0, f"status {s}")
s, r = call("PATCH", f"/api/collections/movimentacoes/records/{pz.get('id')}", tEng, {"status": "Aprovado"})
check("divergencia", "Engenheiro autoriza: saldo passa a ser o contado e fica quem autorizou", s == 200 and saldo(mid) == s0 - 4
      and r.get("autorizado_por") and r.get("motivo_divergencia") == "Sumiço ou furto", err(r) if s >= 400 else f"saldo {saldo(mid)}")
s0 = saldo(mid)
s, r = movc(tAlm, "Inventário", s0)
check("divergencia", "Contagem que bate com o sistema não precisa de motivo nem autorização", s == 200 and r.get("status") == "Aprovado"
      and r.get("diferenca_contagem") == 0, err(r) if s >= 400 else r.get("status"))
s, r = movc(tAlm, "Perda", 1)
check("divergencia", "Perda sem motivo é recusada", s >= 400, f"status {s}")
s, r = movc(tAlm, "Perda", 1, motivo_divergencia="Quebra ou dano")
check("divergencia", "Perda do almoxarife espera autorização", s == 200 and r.get("status") == "Pendente" and saldo(mid) == s0, f"{r.get('status')}")
s, r = movc(tAlm, "Entrada", 2, autorizado_por=uA["id"])
check("divergencia", "Ninguém escreve 'autorizado por' pela tela", s == 200 and not r.get("autorizado_por"), str(r.get("autorizado_por")))

# ------------------------------------------------------------------ ocorrências (Etapa 4.4)
def oco(tok, **extra):
    body = {"tipo": "Quase acidente", "gravidade": "Média", "descricao": "Tábua solta no andaime", "obra_id": obra.get("id")}
    body.update(extra)
    return call("POST", "/api/collections/ocorrencias/records", tok, body)
s, r = oco(tPed, company_id=cB)
check("permissao", "Não dá para registrar ocorrência em outra empresa", s >= 400, f"status {s}")
s, o1 = oco(tPed, status="Resolvida", registrado_por=uA["id"])
check("ocorrencias", "Pedreiro registra ocorrência: nasce Aberta, com número, na própria empresa e no nome dele", s == 200
      and o1.get("status") == "Aberta" and o1.get("numero") == "OCO-0001" and o1.get("company_id") == cA and o1.get("registrado_por") != uA["id"],
      err(o1) if s >= 400 else f"{o1.get('numero')} {o1.get('status')}")
s, r = oco(tPed, descricao="  ")
check("ocorrencias", "Sem descrição é recusada", s >= 400, f"status {s}")
s, o2 = oco(tA, tipo="Acidente", gravidade="Alta", descricao="Queda de material")
check("ocorrencias", "Numeração segue por empresa (OCO-0002)", o2.get("numero") == "OCO-0002", o2.get("numero"))
s, r = call("GET", "/api/collections/ocorrencias/records", tPed)
check("ocorrencias", "Pedreiro vê só as que ele registrou", r.get("totalItems") == 1, f"{r.get('totalItems')}")
s, r = call("GET", "/api/collections/ocorrencias/records", tAlm)
check("ocorrencias", "Gestão vê todas da empresa", r.get("totalItems") == 2, f"{r.get('totalItems')}")
s, r = call("GET", "/api/collections/ocorrencias/records", tB)
check("permissao", "Empresa B não vê ocorrências da A", r.get("totalItems") == 0, f"{r.get('totalItems')}")
s, r = call("PATCH", f"/api/collections/ocorrencias/records/{o1['id']}", tPed, {"status": "Resolvida", "providencia": "ok"})
check("ocorrencias", "Pedreiro não fecha a ocorrência", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/ocorrencias/records/{o1['id']}", tPed, {"descricao": "Tábua solta no andaime do 2º andar"})
check("ocorrencias", "Quem registrou corrige o texto enquanto está Aberta", s == 200, err(r) if s >= 400 else "")
s, r = call("PATCH", f"/api/collections/ocorrencias/records/{o1['id']}", tAlm, {"status": "Resolvida"})
check("ocorrencias", "Fechar exige dizer o que foi feito", s >= 400 and "foi feito" in r.get("message", ""), r.get("message", "")[:60])
s, r = call("PATCH", f"/api/collections/ocorrencias/records/{o1['id']}", tAlm, {"status": "Resolvida", "providencia": "Tábua pregada"})
check("ocorrencias", "Gestão resolve e fica quem resolveu e quando", s == 200 and r.get("resolvido_por") and r.get("data_resolucao"), err(r) if s >= 400 else "")
s, r = call("PATCH", f"/api/collections/ocorrencias/records/{o1['id']}", tPed, {"descricao": "mudando depois"})
check("ocorrencias", "Depois de tratada, quem registrou não muda o texto", s >= 400, f"status {s}")
s, r = call("DELETE", f"/api/collections/ocorrencias/records/{o1['id']}", tA)
check("ocorrencias", "Ninguém apaga ocorrência (nem o administrador)", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/ocorrencias/records/{o1['id']}", tAlm, {"status": "Aberta"})
check("ocorrencias", "Gestão reabre e limpa quem resolveu", s == 200 and not r.get("resolvido_por"), err(r) if s >= 400 else "")
s, r = call("GET", "/api/collections/ocorrencias/records")
check("permissao", "Sem login não vê ocorrências", r.get("totalItems", 0) == 0, f"status {s}")

# ------------------------------------------------------------------ alerta de estoque mínimo (Etapa 4.5)
def notifs(tok, uid):
    return call("GET", "/api/collections/notificacoes/records?perPage=50&filter=" + q(f'usuarioId="{uid}" && tipo="estoque"'), tok)[1].get("items", [])
_, uAlm = login("almox@teste.local")
s, mm = call("POST", "/api/collections/materiais/records", tA, {"name": "Cal hidratada 20kg", "code": "MIN-1", "unit": "sc",
             "quantity_in_stock": 10, "min_quantity": 5, "status": "active", "company_id": cA})
antesA = len(notifs(tA, uA["id"]))
def saida_m(qtd):
    return call("POST", "/api/collections/movimentacoes/records", tA, {"material_id": mm.get("id"), "company_id": cA, "tipo": "Saída",
                "quantidade": qtd, "status": "Aprovado", "data": "2026-10-18"})
saida_m(3)
check("minimo", "Acima do mínimo (10 -> 7, mínimo 5): ninguém é avisado", len(notifs(tA, uA["id"])) == antesA)
saida_m(3)
na = notifs(tA, uA["id"])
check("minimo", "Chegou no mínimo (7 -> 4): administrador recebe aviso no sininho", len(na) == antesA + 1 and "Cal hidratada" in na[0].get("mensagem", "")
      and "restam 4" in na[0].get("mensagem", ""), na[0].get("mensagem", "") if na else "")
check("minimo", "Almoxarife também recebe o aviso", any("Cal hidratada" in n.get("mensagem", "") for n in notifs(tAlm, uAlm["id"])))
check("minimo", "Pedreiro não recebe aviso de estoque", not any("Cal hidratada" in n.get("mensagem", "") for n in notifs(tPed, login("pedreiro.div@teste.local")[1]["id"])))
saida_m(1)
check("minimo", "Continua baixo (4 -> 3): não repete o aviso", len(notifs(tA, uA["id"])) == antesA + 1)
call("POST", "/api/collections/movimentacoes/records", tA, {"material_id": mm.get("id"), "company_id": cA, "tipo": "Entrada",
     "quantidade": 20, "status": "Aprovado", "data": "2026-10-18"})
saida_m(19)
na = notifs(tA, uA["id"])
check("minimo", "Repôs (23) e baixou de novo (4): avisa outra vez", len(na) == antesA + 2, f"{len(na) - antesA}")
saida_m(4)
na = notifs(tA, uA["id"])
check("minimo", "Zerou depois de avisado: não repete (ainda abaixo do mínimo)", len(na) == antesA + 2, f"{len(na) - antesA}")
s, r = call("GET", "/api/collections/materiais/records/" + mm.get("id"), tA)
check("minimo", "Controle interno do aviso não aparece para as telas", "alerta_minimo_enviado" not in r)
s, mz = call("POST", "/api/collections/materiais/records", tA, {"name": "Material sem mínimo", "code": "MIN-0", "unit": "un",
             "quantity_in_stock": 1, "min_quantity": 0, "status": "active", "company_id": cA})
call("POST", "/api/collections/movimentacoes/records", tA, {"material_id": mz.get("id"), "company_id": cA, "tipo": "Saída",
     "quantidade": 1, "status": "Aprovado", "data": "2026-10-18"})
check("minimo", "Material sem mínimo cadastrado não gera aviso", len(notifs(tA, uA["id"])) == antesA + 2)
s, r = call("PATCH", "/api/collections/materiais/records/" + mz.get("id"), tA, {"min_quantity": 2})
check("minimo", "Cadastrar mínimo acima do saldo já avisa", len(notifs(tA, uA["id"])) == antesA + 3)

# ------------------------------------------------------------------ auditoria
s, r = call("POST", "/api/collections/audit_logs/records", tF, {"acao": "teste", "modulo": "x", "usuario_id": uF["id"]})
check("telas", "Usuário logado grava log de auditoria", s == 200, err(r) if s >= 400 else "")
s, r = call("POST", "/api/collections/audit_logs/records", None, {"acao": "falso", "modulo": "x"})
check("auditoria", "Visitante sem login não grava log", s >= 400, f"status {s}")
s, r = call("GET", "/api/collections/auditoria/records?perPage=50", tA)
check("auditoria", "Admin vê os logs da própria empresa", s == 200 and r.get("totalItems", 0) > 0, f"{r.get('totalItems')} logs")
idsA = {x["id"] for x in r.get("items", [])}
s, r = call("GET", "/api/collections/auditoria/records?perPage=50", tB)
check("auditoria", "Empresa B não vê logs da A", s == 200 and not ({x["id"] for x in r.get("items", [])} & idsA), f"status {s}")
if idsA:
    s, r = call("DELETE", f"/api/collections/auditoria/records/{next(iter(idsA))}", tA)
    check("auditoria", "Nem o admin apaga log de auditoria", s >= 400, f"status {s}")
s, r = call("GET", "/api/collections/auditoria/records?perPage=1", tF)
check("auditoria", "Funcionário comum não lê auditoria", s == 200 and r.get("totalItems", 0) == 0, f"status {s}")

# ------------------------------------------------------------------ convite e conta mestre
tok = str(uuid.uuid4())
s, r = call("POST", "/api/collections/users/records", tA, {
    "email": "conv@teste.local", "username": "conv", "password": "Tmp12345678", "passwordConfirm": "Tmp12345678",
    "company_id": cA, "role": "Funcionário", "cargo": "Funcionário", "status": "Inativo", "id_unico": "05",
    "password_reset_token": tok, "password_reset_expires": "2099-01-01 00:00:00.000Z"})
check("telas", "Convite: admin cria acesso com link", s == 200, err(r) if s >= 400 else "")
s, r = call("POST", "/api/custom/get-invite-details", None, {"token": tok})
check("telas", "Convite: link abre os dados", s == 200, err(r) if s >= 400 else "")
s, r = call("POST", "/api/custom/activate-invite", None, {"token": tok, "password": "Nova12345", "passwordConfirm": "Nova12345"})
check("telas", "Convite: funcionário cria a própria senha", s == 200, err(r) if s >= 400 else "")
s, r = call("POST", "/api/collections/users/auth-with-password", body={"identity": "conv@teste.local", "password": "Nova12345"})
check("telas", "Convite: login com a senha nova", s == 200)
s, r = call("POST", "/api/custom/activate-invite", None, {"token": tok, "password": "Outra12345", "passwordConfirm": "Outra12345"})
check("permissao", "Convite: link não pode ser reusado", s >= 400, f"status {s}")

if tSU:
    # A conta mestre pode já existir no banco de teste; o superusuário só
    # define uma senha conhecida para o login.
    s, r = call("GET", "/api/collections/users/records?filter=" + q('email="dnmltda@hotmail.com"'), tSU)
    if r.get("items"):
        s, r = call("PATCH", f"/api/collections/users/records/{r['items'][0]['id']}", tSU,
                    {"password": "Senha12345", "passwordConfirm": "Senha12345", "status": "Ativo"})
    else:
        s, r = call("POST", "/api/collections/users/records", tSU, {
            "email": "dnmltda@hotmail.com", "username": "dnmltda", "password": "Senha12345", "passwordConfirm": "Senha12345",
            "company_id": cA, "role": "admin", "cargo": "Administrador", "status": "Ativo", "id_unico": "01"})
    check("telas", "Conta mestre preparada para o teste", s == 200, err(r) if s >= 400 else "")
    if s == 200:
        tM, _ = login("dnmltda@hotmail.com")
        s, r = call("GET", "/api/collections/companies/records?perPage=50", tM)
        check("telas", "Conta mestre (dnmltda) continua vendo todas as empresas", r.get("totalItems", 0) >= 2, f"{r.get('totalItems')}")

# ------------------------------------------------------------------ fluxo de material (Etapa 4.1)
s, mf = call("POST", "/api/collections/materiais/records", tA, {"name": "Argamassa AC-II", "code": "FLX-1", "unit": "un",
             "quantity_in_stock": 10, "status": "active", "company_id": cA})
def nova_sol(num, qtd):
    s, so = call("POST", "/api/collections/solicitacoes/records", tF, {"company_id": cA, "numero_solicitacao": num, "tipo": "Material",
                 "solicitante_id": uF["id"], "descricao": "pedido de material", "status": "Aberta", "obra_id": obra.get("id")})
    s2, it = call("POST", "/api/collections/solicitacoes_itens/records", tF, {"solicitacao_id": so.get("id"), "material_id": mf.get("id"), "quantidade": qtd})
    return so, s2, it
so, s2, it = nova_sol("SOL-FLX-1", 4)
check("fluxo", "Funcionário pede material com item e quantidade", s2 == 200 and it.get("unidade") == "un", err(it) if s2 >= 400 else "")
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tA, {"status": "Entregue"})
check("fluxo", "Não dá para pular etapa (Aberta -> Entregue)", s >= 400 and "fora de ordem" in r.get("message", ""), r.get("message", "")[:80])
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tF, {"status": "Aprovada"})
check("fluxo", "Quem pediu não aprova", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tA, {"status": "Aprovada"})
check("fluxo", "Gestão aprova", s == 200, err(r) if s >= 400 else "")
s, r = call("POST", "/api/collections/solicitacoes_itens/records", tF, {"solicitacao_id": so["id"], "material_id": mf.get("id"), "quantidade": 1})
check("fluxo", "Depois de aprovada não entra material novo", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/solicitacoes_itens/records/{it['id']}", tA, {"quantidade": 9})
check("fluxo", "Depois de aprovada a quantidade não muda", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tA, {"status": "Em separação"})
check("fluxo", "Almoxarifado começa a separar", s == 200, err(r) if s >= 400 else "")
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tA, {"status": "Entregue"})
check("fluxo", "Não entrega sem o aceite de quem pediu (Em separação -> Entregue)", s >= 400 and "fora de ordem" in r.get("message", ""), r.get("message", "")[:80])
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tF, {"status": "Pronto para retirada"})
check("fluxo", "Quem pediu não marca como separado", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tA, {"status": "Pronto para retirada"})
s_m, m2 = call("GET", f"/api/collections/materiais/records/{mf.get('id')}", tA)
check("fluxo", "Almoxarifado marca 'Pronto para retirada' e o estoque ainda não baixa", s == 200 and r.get("separado_por") == uA["id"]
      and m2.get("quantity_in_stock") == 10, err(r) if s >= 400 else f"saldo {m2.get('quantity_in_stock')}")
s, ns = call("GET", "/api/collections/notificacoes/records?filter=" + q(f'usuarioId="{uF["id"]}" && referencia="solicitacao:{so["id"]}"'), tF)
check("fluxo", "Quem pediu é avisado no sininho que o material está separado", ns.get("totalItems", 0) >= 1, f"{ns.get('totalItems')}")
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tF, {"status": "Em separação"})
check("fluxo", "Recusar o material exige dizer o que está errado", s >= 400 and "errado" in r.get("message", ""), r.get("message", "")[:80])
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tF, {"status": "Em separação", "retirada_recusa_motivo": "veio argamassa AC-I"})
s_m, m2 = call("GET", f"/api/collections/materiais/records/{mf.get('id')}", tA)
check("fluxo", "Quem pediu recusa o material errado: volta para separação, estoque não muda", s == 200 and r.get("status") == "Em separação"
      and m2.get("quantity_in_stock") == 10, err(r) if s >= 400 else "")
call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tA, {"status": "Pronto para retirada"})
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tPed, {"status": "Concluída", "foto_retirada": FOTO})
check("fluxo", "Outra pessoa (pedreiro, nem quem pediu nem o estoque) não aceita a retirada", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tF, {"status": "Concluída"})
check("foto", "Retirada sem a foto de quem leva é recusada", s >= 400 and "foto" in r.get("message", ""), r.get("message", "")[:80])
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tF, {"status": "Concluída", "foto_retirada": FOTO})
s_m, m2 = call("GET", f"/api/collections/materiais/records/{mf.get('id')}", tA)
check("fluxo", "Quem pediu aceita na retirada (com foto) e o estoque baixa (10 -> 6)", s == 200 and m2.get("quantity_in_stock") == 6,
      err(r) if s >= 400 else f"saldo {m2.get('quantity_in_stock')}")
check("foto", "A foto fica gravada na retirada, com quem registrou", bool(r.get("foto_retirada")) and r.get("retirada_registrada_por") == uF["id"], str(r.get("foto_retirada")))
_foto1 = r.get("foto_retirada")
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tA, {"foto_retirada": FOTO, "descricao": "troca"})
check("foto", "Depois da retirada ninguém troca a foto", r.get("foto_retirada") == _foto1, str(r.get("foto_retirada")))
_sf = urllib.request.Request(B + f"/api/files/solicitacoes/{so['id']}/{_foto1}")
try:
    _sfs = urllib.request.urlopen(_sf).status
except urllib.error.HTTPError as _e:
    _sfs = _e.code
check("foto", "A foto não abre sem login (arquivo protegido)", _sfs >= 400, f"status {_sfs}")
_tk = call("POST", "/api/files/token", tA, {})[1].get("token", "")
try:
    _sfs = urllib.request.urlopen(B + f"/api/files/solicitacoes/{so['id']}/{_foto1}?token={_tk}").status
except urllib.error.HTTPError as _e:
    _sfs = _e.code
check("foto", "A gestão da empresa abre a foto com o login", _sfs == 200, f"status {_sfs}")
s, movs = call("GET", "/api/collections/movimentacoes/records?filter=" + q(f'solicitacao_id="{so["id"]}"'), tA)
check("fluxo", "A saída fica ligada à solicitação (Consumo de Obra, quem pediu não tem cadastro de funcionário)",
      movs.get("totalItems") == 1 and movs["items"][0].get("tipo") == "Consumo de Obra" and movs["items"][0].get("responsavel_id") == uA["id"])
s, it2 = call("GET", f"/api/collections/solicitacoes_itens/records/{it['id']}", tA)
check("fluxo", "Item registra a quantidade entregue", it2.get("quantidade_entregue") == 4 and bool(it2.get("movimentacao_id")))
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so['id']}", tF, {"status": "Cancelada"})
check("fluxo", "Depois de retirado não dá para cancelar", s >= 400, f"status {s}")
s, sx = call("POST", "/api/collections/solicitacoes/records", tF, {"company_id": cA, "numero_solicitacao": "SOL-ESPERTO", "tipo": "Material",
             "solicitante_id": uF["id"], "descricao": "tentando pular", "status": "Aprovada"})
check("fluxo", "Funcionário que cria pedido já 'Aprovada' fica 'Aberta'", s == 200 and sx.get("status") == "Aberta", sx.get("status"))
s, ns = call("GET", "/api/collections/notificacoes/records?filter=" + q(f'usuarioId="{uA["id"]}" && referencia="solicitacao:{sx["id"]}"'), tA)
check("fluxo", "Pedido de material novo avisa o estoque no sininho", ns.get("totalItems", 0) >= 1, f"{ns.get('totalItems')}")
so2, s2, it3 = nova_sol("SOL-FLX-2", 999)
for st in ("Aprovada", "Em separação", "Pronto para retirada"):
    call("PATCH", f"/api/collections/solicitacoes/records/{so2['id']}", tA, {"status": st})
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so2['id']}", tF, {"status": "Concluída", "foto_retirada": FOTO})
s_m, m3 = call("GET", f"/api/collections/materiais/records/{mf.get('id')}", tA)
s_s, sol2 = call("GET", f"/api/collections/solicitacoes/records/{so2['id']}", tA)
check("fluxo", "Aceite sem saldo é recusado e nada muda", s >= 400 and "Saldo insuficiente" in r.get("message", "") and m3.get("quantity_in_stock") == 6
      and sol2.get("status") == "Pronto para retirada", r.get("message", "")[:90])

# ------------------------------------------------------------------ estoque geral + estoque por obra (19/10/2026)
s, me = call("POST", "/api/collections/materiais/records", tA, {"name": "Tijolo 8 furos", "code": "EOB-1", "unit": "un",
             "quantity_in_stock": 100, "unit_cost": 1.5, "status": "active", "company_id": cA})
def geral():
    return call("GET", f"/api/collections/materiais/records/{me.get('id')}", tA)[1].get("quantity_in_stock")
def na_obra(tok=tA):
    s, r = call("GET", "/api/collections/estoque_obra/records?filter=" + q(f'obra_id="{obra.get("id")}" && material_id="{me.get("id")}"'), tok)
    return (r.get("items") or [{}])[0].get("quantidade", 0)
def mov(tipo, qtd, **extra):
    body = {"company_id": cA, "material_id": me.get("id"), "tipo": tipo, "quantidade": qtd, "status": "Aprovado"}
    body.update(extra)
    return call("POST", "/api/collections/movimentacoes/records", tA, body)
s, t1 = mov("Transferência para Obra", 40, estoque_obra_id=obra.get("id"), obra_id=obra.get("id"))
check("estoque_obra", "Transferir 40 do geral para a obra: geral 100 -> 60, obra 0 -> 40", s == 200 and geral() == 60 and na_obra() == 40,
      err(t1) if s >= 400 else f"geral {geral()} obra {na_obra()}")
s, r = mov("Transferência para Obra", 5)
check("estoque_obra", "Transferência sem obra é recusada", s >= 400 and "obra" in r.get("message", ""), r.get("message", "")[:80])
s, r = mov("Transferência para Obra", 500, estoque_obra_id=obra.get("id"))
check("estoque_obra", "Transferir mais do que tem no geral é recusado", s >= 400 and "insuficiente" in r.get("message", "") and geral() == 60, r.get("message", "")[:80])
s, r = mov("Consumo de Obra", 15, estoque_obra_id=obra.get("id"), obra_id=obra.get("id"))
check("estoque_obra", "Consumo da obra sai do estoque da obra (40 -> 25) e o geral não muda (60)", s == 200 and na_obra() == 25 and geral() == 60,
      err(r) if s >= 400 else f"geral {geral()} obra {na_obra()}")
s, r = mov("Consumo de Obra", 30, estoque_obra_id=obra.get("id"))
check("estoque_obra", "Consumo maior do que o estoque da obra é recusado", s >= 400 and "estoque da obra" in r.get("message", "") and na_obra() == 25, r.get("message", "")[:90])
s, r = mov("Inventário", 22, estoque_obra_id=obra.get("id"), motivo_divergencia="Contagem diferente do sistema")
check("estoque_obra", "Inventário da obra: saldo da obra passa a ser 22, geral não muda", s == 200 and na_obra() == 22 and geral() == 60,
      err(r) if s >= 400 else f"geral {geral()} obra {na_obra()}")
s, dv = mov("Devolução da Obra", 2, estoque_obra_id=obra.get("id"))
check("estoque_obra", "Devolver 2 da obra ao geral: obra 22 -> 20, geral 60 -> 62", s == 200 and na_obra() == 20 and geral() == 62,
      err(dv) if s >= 400 else f"geral {geral()} obra {na_obra()}")
s, r = call("PATCH", f"/api/collections/movimentacoes/records/{dv.get('id')}", tA, {"status": "Cancelado", "motivo_cancelamento": "teste"})
check("estoque_obra", "Cancelar a devolução estorna os dois estoques (obra 20, geral 60)", s == 200 and na_obra() == 22 and geral() == 60,
      err(r) if s >= 400 else f"geral {geral()} obra {na_obra()}")
s, r = call("POST", "/api/collections/estoque_obra/records", tA, {"company_id": cA, "obra_id": obra.get("id"), "material_id": me.get("id"), "quantidade": 999})
check("estoque_obra", "Ninguém grava o estoque da obra direto pela API", s >= 400, f"status {s}")
s, r = call("GET", "/api/collections/estoque_obra/records", tB)
check("isolamento", "Outra empresa não vê o estoque das obras", s == 200 and r.get("totalItems") == 0, f"{r.get('totalItems')}")
check("estoque_obra", "Funcionário comum não vê o estoque da obra (só quem cuida do estoque)", na_obra(tF) == 0)
check("estoque_obra", "Almoxarife vê o estoque da obra", na_obra(tAlm) == 22)
# pedido de material separado do estoque da obra
s, so3 = call("POST", "/api/collections/solicitacoes/records", tF, {"company_id": cA, "numero_solicitacao": "SOL-EOB-1", "tipo": "Material",
              "solicitante_id": uF["id"], "descricao": "tijolo da obra", "status": "Aberta", "obra_id": obra.get("id")})
call("POST", "/api/collections/solicitacoes_itens/records", tF, {"solicitacao_id": so3.get("id"), "material_id": me.get("id"), "quantidade": 10})
for st in ("Aprovada", "Em separação"):
    call("PATCH", f"/api/collections/solicitacoes/records/{so3['id']}", tA, {"status": st})
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so3['id']}", tA, {"status": "Pronto para retirada", "estoque_obra_id": obra.get("id")})
s2, r2 = call("PATCH", f"/api/collections/solicitacoes/records/{so3['id']}", tF, {"status": "Concluída", "estoque_obra_id": "", "foto_retirada": FOTO})
check("estoque_obra", "Pedido separado do estoque da obra: no aceite sai da obra (22 -> 12), geral fica 60", s == 200 and s2 == 200
      and na_obra() == 12 and geral() == 60, (err(r) if s >= 400 else err(r2) if s2 >= 400 else f"geral {geral()} obra {na_obra()}"))

# ------------------------------------------------------------------ saldo do funcionário e uso na obra (19/10/2026)
cargoU = (call("GET", "/api/collections/cargos/records?perPage=1", tA)[1].get("items") or [{}])[0].get("id", "")
s, funU = call("POST", "/api/collections/funcionarios/records", tA, {"matricula": "M-USO", "nome": "Eletricista do Fio",
               "nome_completo": "Eletricista do Fio", "cargoId": cargoU, "email": "eletricista@teste.local", "company_id": cA})
check("uso", "Cadastro do eletricista (funcionário)", s == 200, err(funU) if s >= 400 else "")
call("POST", "/api/collections/users/records", tA, {"email": "eletricista@teste.local", "username": "eletricista", "password": "Senha12345",
     "passwordConfirm": "Senha12345", "company_id": cA, "cargo": "Eletricista", "role": "Eletricista", "status": "Ativo",
     "funcionario_id": funU.get("id"), "name": "Eletricista do Fio"})
tEl, uEl = login("eletricista@teste.local")
s, fio = call("POST", "/api/collections/materiais/records", tA, {"name": "Fio flexível azul 2,5mm (rolo 100m)", "code": "USO-FIO", "unit": "rl",
              "quantity_in_stock": 10, "unit_cost": 250, "status": "active", "company_id": cA})
check("uso", "Material do teste (fio, rolo)", s == 200, err(fio) if s >= 400 else "")
s, so3 = call("POST", "/api/collections/solicitacoes/records", tEl, {"company_id": cA, "numero_solicitacao": "SOL-USO-1", "tipo": "Material",
              "solicitante_id": uEl["id"], "descricao": "fio", "status": "Aberta", "obra_id": obra.get("id")})
call("POST", "/api/collections/solicitacoes_itens/records", tEl, {"solicitacao_id": so3.get("id"), "material_id": fio.get("id"), "quantidade": 3})
for st in ("Aprovada", "Em separação", "Pronto para retirada"):
    call("PATCH", f"/api/collections/solicitacoes/records/{so3['id']}", tAlm, {"status": st})
s, r = call("PATCH", f"/api/collections/solicitacoes/records/{so3['id']}", tAlm, {"status": "Concluída", "foto_retirada": FOTO})
check("foto", "No balcão o almoxarifado registra a retirada com a foto de quem leva", s == 200 and r.get("retirada_registrada_por") != uEl["id"]
      and bool(r.get("foto_retirada")), err(r) if s >= 400 else "")
s, movs = call("GET", "/api/collections/movimentacoes/records?filter=" + q(f'solicitacao_id="{so3["id"]}"'), tA)
s_sf, sf = call("GET", "/api/collections/saldo_funcionario/records?filter=" + q(f'funcionario_id="{funU["id"]}"'), tA)
check("uso", "Aceite de quem tem cadastro de funcionário vira Retirada por Funcionário e entra no saldo dele",
      movs.get("totalItems") == 1 and movs["items"][0].get("tipo") == "Retirada por Funcionário" and sf.get("totalItems") == 1
      and sf["items"][0].get("tipo_operacao") == "Retirada" and sf["items"][0].get("quantidade") == 3,
      f"mov {[x.get('tipo') for x in movs.get('items', [])]} saldo {sf.get('totalItems')}")
def uso(tok, qtd, **extra):
    body = {"company_id": cA, "funcionario_id": funU.get("id"), "material_id": fio.get("id"), "tipo_operacao": "Utilização",
            "quantidade": qtd, "data_operacao": "2026-10-19", "obra_id": obra.get("id"), "local_uso": "3º andar"}
    body.update(extra)
    return call("POST", "/api/collections/saldo_funcionario/records", tok, body)
s, r = uso(tEl, 2, local_uso="  ")
check("uso", "Registrar uso exige dizer onde foi usado", s >= 400 and "onde" in r.get("message", ""), r.get("message", "")[:80])
s, r = uso(tEl, 2, obra_id="")
check("uso", "Registrar uso exige a obra", s >= 400, f"status {s}")
s, r = uso(tEl, 5)
check("uso", "Não dá para usar mais do que está em posse (3)", s >= 400 and "em posse" in r.get("message", ""), r.get("message", "")[:80])
s, r = uso(tEl, 2)
if s == 200:  # o valor não vai para o eletricista (só para quem cuida do estoque): confere pelo administrador
    r = call("GET", f"/api/collections/saldo_funcionario/records/{r.get('id')}", tA)[1]
s_m, fio2 = call("GET", f"/api/collections/materiais/records/{fio.get('id')}", tA)
check("uso", "Eletricista registra o uso de 2 rolos no 3º andar: vale 2 x 250 e o estoque não muda (7)",
      s == 200 and r.get("valor_total") == 500 and r.get("responsavel_id") == uEl["id"] and fio2.get("quantity_in_stock") == 7,
      err(r) if s >= 400 else f"valor {r.get('valor_total')} estoque {fio2.get('quantity_in_stock')}")
s, r2 = uso(tEl, 1.5)
check("uso", "Sobrou 1 em posse: usar 1,5 é recusado", s >= 400, f"status {s}")
s, outroF = call("POST", "/api/collections/funcionarios/records", tA, {"matricula": "M-OUT", "nome": "Outro", "nome_completo": "Outro",
                 "cargoId": cargoU, "company_id": cA})
s, r2 = uso(tEl, 1, funcionario_id=outroF.get("id"))
check("uso", "Funcionário não registra uso no saldo de outra pessoa", s == 403, f"status {s}")
s, r2 = call("POST", "/api/collections/saldo_funcionario/records", tEl, {"company_id": cA, "funcionario_id": funU.get("id"), "material_id": fio.get("id"),
             "tipo_operacao": "Retirada", "quantidade": 50, "data_operacao": "2026-10-19"})
check("uso", "Funcionário não inventa retirada para aumentar o próprio saldo", s == 403, f"status {s}")
s, r2 = call("PATCH", f"/api/collections/saldo_funcionario/records/{r.get('id')}", tEl, {"quantidade": 0.1})
check("uso", "Funcionário não altera um uso já lançado", s >= 400, f"status {s}")
s, r2 = uso(tAlm, 1, local_uso="Térreo, quadro de luz")
check("uso", "Almoxarifado registra o uso no saldo do funcionário", s == 200, err(r2) if s >= 400 else "")
s, r2 = call("GET", "/api/collections/saldo_funcionario/records?filter=" + q('tipo_operacao="Utilização"'), tB)
check("isolamento", "Empresa B não vê os usos da A", s == 200 and r2.get("totalItems") == 0, f"{r2.get('totalItems')}")

# ------------------------------------------------------------------ empréstimo de equipamento (Etapa 4.2)
cargo1 = (call("GET", "/api/collections/cargos/records?perPage=1", tA)[1].get("items") or [{}])[0].get("id", "")
s, funE = call("POST", "/api/collections/funcionarios/records", tA, {"matricula": "M-EQ", "nome": "Pedreiro do Martelete",
               "nome_completo": "Pedreiro do Martelete", "cargoId": cargo1, "company_id": cA})
def novo_eq(nome, cid=None, tok=None):
    s, eq = call("POST", "/api/collections/equipamentos/records", tok or tA, {"nome": nome, "codigo_interno": nome[:6].upper(),
                 "situacao": "Disponível", "company_id": cid or cA})
    return eq
def emp(eq, tok=None, **extra):
    return call("POST", "/api/collections/emprestimos/records", tok or tA, {"equipment_id": eq.get("id"), "funcionario_id": funE.get("id"),
                "obra_id": obra.get("id"), "company_id": cA, "expected_return_date": "2026-12-31 12:00:00", "foto_retirada": FOTO, **extra})
def eqget(eq):
    return call("GET", f"/api/collections/equipamentos/records/{eq.get('id')}", tA)[1]
e1 = novo_eq("Martelete 1")
s, r = emp(e1, tF)
check("equip", "Funcionário comum não empresta equipamento", s >= 400, f"status {s}")
s, l1 = emp(e1)
x = eqget(e1)
check("equip", "Gestão empresta: equipamento fica 'Emprestado' com a pessoa e a obra", s == 200 and x.get("situacao") == "Emprestado"
      and x.get("funcionario_id") == funE.get("id") and x.get("obra_atual_id") == obra.get("id"), err(l1) if s >= 400 else x.get("situacao"))
check("equip", "Empréstimo nasce aberto, com data e quem entregou", l1.get("status") == "active" and bool(l1.get("borrow_date")) and l1.get("entregue_por") == uA["id"])
s, r = emp(e1)
check("equip", "Não dá para emprestar o que já está emprestado", s >= 400 and "não está disponível" in r.get("message", ""), r.get("message", "")[:80])
s, r = call("PATCH", f"/api/collections/equipamentos/records/{e1.get('id')}", tA, {"situacao": "Disponível"})
check("equip", "Situação de equipamento emprestado não muda pela edição comum", s >= 400 and eqget(e1).get("situacao") == "Emprestado", f"status {s}")
s, r = call("PATCH", f"/api/collections/emprestimos/records/{l1.get('id')}", tA, {"status": "returned"})
check("equip", "Devolver exige dizer em que estado voltou", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/emprestimos/records/{l1.get('id')}", tF, {"status": "returned", "estado_devolucao": "Bom"})
check("equip", "Funcionário comum não registra devolução", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/emprestimos/records/{l1.get('id')}", tA, {"status": "returned", "estado_devolucao": "Bom"})
x = eqget(e1)
check("equip", "Voltou bom: fica 'Disponível' no almoxarifado, sem pessoa nem obra", s == 200 and x.get("situacao") == "Disponível"
      and not x.get("funcionario_id") and not x.get("obra_atual_id") and r.get("recebido_por") == uA["id"] and bool(r.get("return_date")),
      err(r) if s >= 400 else x.get("situacao"))
s, r = call("PATCH", f"/api/collections/emprestimos/records/{l1.get('id')}", tA, {"estado_devolucao": "Danificado"})
check("equip", "Devolução registrada não se altera depois", s >= 400, f"status {s}")
s, h = call("GET", "/api/collections/equipamentos_historico/records?filter=" + q(f'equipamento_id="{e1.get("id")}"'), tA)
check("equip", "Empréstimo e devolução ficam no histórico do equipamento", h.get("totalItems") == 2, f"{h.get('totalItems')}")
e2 = novo_eq("Betoneira 1")
s, l2 = emp(e2)
s, r = call("PATCH", f"/api/collections/emprestimos/records/{l2.get('id')}", tA, {"status": "returned", "estado_devolucao": "Precisa de manutenção",
            "observacao_devolucao": "motor falhando"})
s2, mm = call("GET", "/api/collections/equipamentos_manutencao/records?filter=" + q(f'equipamento_id="{e2.get("id")}"'), tA)
check("equip", "Voltou precisando de manutenção: 'Em Manutenção' + manutenção corretiva agendada", s == 200 and eqget(e2).get("situacao") == "Em Manutenção"
      and mm.get("totalItems") == 1 and "motor falhando" in mm["items"][0].get("descricao", ""), err(r) if s >= 400 else "")
e3 = novo_eq("Furadeira 1")
s, l3 = emp(e3)
call("PATCH", f"/api/collections/emprestimos/records/{l3.get('id')}", tA, {"status": "returned", "estado_devolucao": "Perdido"})
check("equip", "Perdido: equipamento fica 'Extraviado'", eqget(e3).get("situacao") == "Extraviado", eqget(e3).get("situacao"))
eF = novo_eq("Furadeira sem foto")
s, r = emp(eF, foto_retirada=None)
check("foto", "Empréstimo de equipamento sem a foto de quem leva é recusado", s >= 400 and "foto" in r.get("message", "")
      and eqget(eF).get("situacao") == "Disponível", r.get("message", "")[:80])
eB = novo_eq("Martelete B", cB, tB)
s, r = call("POST", "/api/collections/emprestimos/records", tA, {"equipment_id": eB.get("id"), "funcionario_id": funE.get("id"), "company_id": cA, "foto_retirada": FOTO})
check("permissao", "Empresa A não empresta equipamento da Empresa B", s >= 400, f"status {s}")

# ---- passar o equipamento para outra pessoa (repasse na obra, 20/10/2026)
_fc = {}
for _n in ("Ana do Carrinho", "Beto do Carrinho"):
    _fc[_n] = call("POST", "/api/collections/funcionarios/records", tA, {"matricula": "M-" + _n[:3].upper(), "nome": _n, "nome_completo": _n,
                   "cargoId": cargo1, "company_id": cA})[1]
    _em = _n.split()[0].lower() + ".carrinho@teste.local"
    call("POST", "/api/collections/users/records", tA, {"email": _em, "username": _em.split("@")[0].replace(".", ""), "password": "Senha12345",
         "passwordConfirm": "Senha12345", "company_id": cA, "cargo": "Servente", "role": "Servente", "status": "Ativo",
         "funcionario_id": _fc[_n].get("id"), "name": _n})
tAna, tBeto = login("ana.carrinho@teste.local")[0], login("beto.carrinho@teste.local")[0]
e4 = novo_eq("Carrinho de mão")
s, l4 = emp(e4, funcionario_id=_fc["Ana do Carrinho"].get("id"))
def repasse(tok, de, para, **extra):
    return call("POST", "/api/collections/emprestimos/records", tok, {"repassado_de": de.get("id"), "company_id": cA, "funcionario_id": para.get("id"),
                "local_entrega": "3º andar, torre B", "foto_retirada": FOTO, **extra})
s, r = repasse(tAna, l4, _fc["Beto do Carrinho"], local_entrega="")
check("equip", "Passar para outra pessoa exige dizer onde estão", s >= 400 and "onde" in r.get("message", ""), r.get("message", "")[:80])
s, r = repasse(tAna, l4, _fc["Beto do Carrinho"], foto_retirada=None)
check("equip", "Passar para outra pessoa exige a foto da troca", s >= 400 and "foto" in r.get("message", ""), r.get("message", "")[:80])
s, r = repasse(tPed, l4, _fc["Beto do Carrinho"])
check("equip", "Quem não está com o equipamento (e não é da gestão) não passa adiante", s >= 400, f"status {s}")
s, l5 = repasse(tAna, l4, _fc["Beto do Carrinho"])
x = eqget(e4)
_l4 = call("GET", f"/api/collections/emprestimos/records/{l4.get('id')}", tA)[1]
check("equip", "Quem está com o equipamento passa para outra pessoa: fica com ela, no local informado", s == 200
      and x.get("situacao") == "Emprestado" and x.get("funcionario_id") == _fc["Beto do Carrinho"].get("id") and "3º andar" in x.get("local_atual", "")
      and l5.get("status") == "active" and l5.get("local_entrega") == "3º andar, torre B" and bool(l5.get("foto_retirada")), err(l5) if s >= 400 else str(x.get("local_atual")))
check("equip", "O empréstimo de quem passou fecha como 'Repassado'", _l4.get("status") == "returned" and _l4.get("estado_devolucao") == "Repassado"
      and "Beto do Carrinho" in _l4.get("observacao_devolucao", ""), str(_l4.get("estado_devolucao")))
s, h = call("GET", "/api/collections/equipamentos_historico/records?filter=" + q(f'equipamento_id="{e4.get("id")}"'), tA)
check("equip", "A troca fica no histórico do equipamento, com o local", any("Passado de Ana do Carrinho para Beto do Carrinho" in (i.get("alteracao_realizada") or "")
      and "3º andar" in (i.get("detalhes") or "") for i in h.get("items", [])))
s, r = repasse(tAna, l4, _fc["Beto do Carrinho"])
check("equip", "Não dá para passar de novo um empréstimo que já foi passado", s >= 400, f"status {s}")
s, r = repasse(tBeto, l5, _fc["Ana do Carrinho"], local_entrega="Térreo")
check("equip", "Quem recebeu pode passar adiante de novo", s == 200 and eqget(e4).get("funcionario_id") == _fc["Ana do Carrinho"].get("id"), err(r) if s >= 400 else "")
s, r = call("GET", "/api/collections/emprestimos/records", tB)
check("permissao", "Empresa B não vê os empréstimos da A", r.get("totalItems") == 0, f"{r.get('totalItems')}")
s, r = call("GET", "/api/collections/emprestimos/records")
check("permissao", "Sem login não vê empréstimos", r.get("totalItems", 0) == 0, f"status {s}")

# ------------------------------------------------------------------ excluir vira arquivar
s, fx = call("POST", "/api/collections/fornecedores/records", tA, {"nome": "Fornecedor a arquivar", "cnpj": "99999999000199", "company_id": cA})
s, r = call("DELETE", f"/api/collections/fornecedores/records/{fx.get('id')}", tF)
check("permissao", "Funcionário comum não exclui fornecedor", s >= 400, f"status {s}")
s, r = call("DELETE", f"/api/collections/fornecedores/records/{fx.get('id')}", tA)
check("telas", "Admin exclui fornecedor (tela recebe sucesso)", s == 204, f"status {s}")
s, r = call("GET", "/api/collections/fornecedores/records?perPage=200", tA)
check("telas", "Fornecedor excluído some da lista", s == 200 and fx.get("id") not in json.dumps(r))
if tSU:
    s, r = call("GET", f"/api/collections/fornecedores/records/{fx.get('id')}", tSU)
    check("arquivo", "Fornecedor excluído continua no banco, arquivado com data", s == 200 and bool(r.get("deleted_at")), f"status {s}")
s, r = call("POST", "/api/collections/fornecedores/records", tA, {"nome": "Fornecedor recadastrado", "cnpj": "99999999000199", "company_id": cA})
check("telas", "Dá para cadastrar de novo o mesmo CNPJ depois de excluir", s == 200, err(r) if s >= 400 else "")
if mat:
    s, m = call("POST", "/api/collections/materiais/records", tA, {"name": "Material que vai sair de linha", "code": "TST-ARQ", "unit": "un",
                "quantity_in_stock": 3, "status": "active", "company_id": cA})
    call("DELETE", f"/api/collections/materiais/records/{m.get('id')}", tA)
    s, r = call("GET", "/api/collections/movimentacoes/records?expand=material_id&filter=" + q(f'material_id="{m.get("id")}"'), tA)
    nome = ((r.get("items") or [{}])[0].get("expand") or {}).get("material_id", {}).get("name")
    check("arquivo", "Histórico continua mostrando o nome do material excluído", nome == "Material que vai sair de linha", f"{nome}")
s, uX = call("POST", "/api/collections/users/records", tA, {"email": "sai@teste.local", "username": "sai", "password": "Senha12345",
             "passwordConfirm": "Senha12345", "company_id": cA, "cargo": "Funcionário", "role": "Funcionário", "status": "Ativo", "id_unico": "09"})
s, r = call("DELETE", f"/api/collections/users/records/{uX.get('id')}", tA)
s2, r2 = call("GET", f"/api/collections/users/records/{uX.get('id')}", tA)
check("telas", "Excluir usuário inativa (continua na Gestão de Acessos para reativar)", s == 204 and r2.get("status") == "Inativo", f"status {s}/{r2.get('status')}")

# ------------------------------------------------------------------ ID por ordem de chegada
check("ids", "Quem abriu a empresa é o 01", uA.get("id_unico") == "01" and uB.get("id_unico") == "01", f"{uA.get('id_unico')}/{uB.get('id_unico')}")
s, r = call("GET", f"/api/collections/users/records/{uF['id']}", tA)
check("ids", "Segunda pessoa da empresa é a 02 (mesmo sendo funcionário comum)", r.get("id_unico") == "02", r.get("id_unico"))
s, fun = call("POST", "/api/collections/funcionarios/records", tA, {"matricula": "M-ENG", "nome": "Engenheiro Novo", "nome_completo": "Engenheiro Novo",
              "id_unico": "FUN-000001", "cargoId": (call("GET", "/api/collections/cargos/records?perPage=1", tA)[1].get("items") or [{}])[0].get("id", ""),
              "company_id": cA, "email": "eng.novo@teste.local"})
check("ids", "Funcionário novo recebe o próximo número, ignorando o que a tela mandou", s == 200 and fun.get("id_unico") not in ("FUN-000001", "", None)
      and fun.get("id_unico", "").isdigit(), err(fun) if s >= 400 else fun.get("id_unico"))
s, acc = call("POST", "/api/collections/users/records", tA, {"email": "eng.novo@teste.local", "username": "engnovo", "password": "Senha12345",
              "passwordConfirm": "Senha12345", "company_id": cA, "cargo": "Engenheiro", "role": "Engenheiro", "status": "Ativo",
              "id_unico": "77", "funcionario_id": fun.get("id")})
check("ids", "Acesso ao sistema do mesmo funcionário usa o mesmo número", s == 200 and acc.get("id_unico") == fun.get("id_unico"),
      err(acc) if s >= 400 else f"{acc.get('id_unico')} = {fun.get('id_unico')}")
s, r = call("PATCH", f"/api/collections/users/records/{acc.get('id')}", tA, {"id_unico": "01"})
check("ids", "Ninguém troca o número depois (nem o administrador)", r.get("id_unico") == fun.get("id_unico"), f"status {s} id {r.get('id_unico')}")
s, r = call("PATCH", f"/api/collections/funcionarios/records/{fun.get('id')}", tA, {"id_unico": "01"})
check("ids", "Número do funcionário também não muda", r.get("id_unico") == fun.get("id_unico"), f"status {s} id {r.get('id_unico')}")
s, b2 = call("POST", "/api/collections/users/records", tB, {"email": "b2@teste.local", "username": "bdois", "password": "Senha12345",
             "passwordConfirm": "Senha12345", "company_id": cB, "cargo": "Pedreiro", "role": "Pedreiro", "status": "Ativo"})
check("ids", "Cada empresa tem a sua sequência (B: 02)", b2.get("id_unico") == "02", b2.get("id_unico"))
ult = int(fun.get("id_unico") or 0)
call("DELETE", f"/api/collections/funcionarios/records/{fun.get('id')}", tA)
s, n2 = call("POST", "/api/collections/funcionarios/records", tA, {"matricula": "M-NOVO2", "nome": "Servente Novo", "nome_completo": "Servente Novo",
             "cargoId": fun.get("cargoId", ""), "company_id": cA})
check("ids", "Número de quem saiu não é reaproveitado", s == 200 and int(n2.get("id_unico") or 0) > ult, err(n2) if s >= 400 else f"{ult} -> {n2.get('id_unico')}")

# ------------------------------------------------------------------ acesso com e-mail já usado (19/10/2026)
def convite(email, func_id, tok=None):
    return call("POST", "/api/collections/users/records", tok or tA, {"email": email, "username": "u" + uuid.uuid4().hex[:8],
                "password": "Descartavel123!", "passwordConfirm": "Descartavel123!", "company_id": cA, "cargo": "Pedreiro",
                "role": "Pedreiro", "status": "Inativo", "funcionario_id": func_id, "password_reset_token": str(uuid.uuid4())})
s, fR = call("POST", "/api/collections/funcionarios/records", tA, {"matricula": "M-REC", "nome": "Recontratado", "nome_completo": "Recontratado",
             "cargoId": fun.get("cargoId", ""), "company_id": cA, "email": "recontratado@teste.local"})
s, uR = convite("recontratado@teste.local", fR.get("id"))
check("acesso", "Convite normal para funcionário novo", s == 200 and uR.get("id_unico") == fR.get("id_unico"), err(uR) if s >= 400 else "")
s, uR2 = convite("recontratado@teste.local", fR.get("id"))
check("acesso", "Reenviar convite (mesmo funcionário, convite não aceito): cria de novo com o mesmo número",
      s == 200 and uR2.get("id_unico") == fR.get("id_unico"), err(uR2) if s >= 400 else uR2.get("id_unico"))
call("DELETE", f"/api/collections/users/records/{uR2.get('id')}", tA)
call("DELETE", f"/api/collections/funcionarios/records/{fR.get('id')}", tA)
s, fR3 = call("POST", "/api/collections/funcionarios/records", tA, {"matricula": "M-REC2", "nome": "Recontratado", "nome_completo": "Recontratado",
              "cargoId": fun.get("cargoId", ""), "company_id": cA, "email": "recontratado@teste.local"})
s, uR3 = convite("recontratado@teste.local", fR3.get("id"))
check("acesso", "Excluído e recontratado com o mesmo e-mail: acesso criado e volta com o número antigo", s == 200
      and uR3.get("id_unico") == fR3.get("id_unico") and fR3.get("id_unico") == fR.get("id_unico"), err(uR3) if s >= 400 else uR3.get("id_unico"))
s, r = call("POST", "/api/collections/funcionarios/records", tA, {"matricula": "M-REC3", "nome": "Outro", "nome_completo": "Outro",
            "cargoId": fun.get("cargoId", ""), "company_id": cA, "email": "recontratado@teste.local"})
check("acesso", "Outro funcionário com o mesmo e-mail: mensagem clara", s >= 400 and "Já existe um funcionário com este e-mail" in r.get("message", ""), r.get("message", "")[:80])
s, r = call("POST", "/api/collections/users/records", tB, {"email": "recontratado@teste.local", "username": "outraempresa", "password": "Senha12345",
            "passwordConfirm": "Senha12345", "company_id": cB, "cargo": "Pedreiro", "role": "Pedreiro", "status": "Ativo"})
check("acesso", "E-mail usado em outra empresa: recusado sem dizer qual", s >= 400 and "outra empresa" in r.get("message", ""), r.get("message", "")[:80])

# ------------------------------------------------------------------ estoque de EPI pelo servidor (20/10/2026)
def epi_saldo(i):
    return call("GET", f"/api/collections/epis/records/{i}", tA)[1].get("quantidade_estoque")
s, epi = call("POST", "/api/collections/epis/records", tA, {"nome": "Capacete de teste", "tipo": "Capacete", "id_unico": "EPI-T1",
              "quantidade_estoque": 10, "estoque_minimo": 2, "company_id": cA})
check("epi", "EPI cadastrado com estoque inicial 10", s == 200 and epi_saldo(epi.get("id")) == 10, err(epi) if s >= 400 else "")
def entrega(q, tok=None, cid=None, col="epis_entregas", extra=None):
    num = "T-" + uuid.uuid4().hex[:6]
    body = {"funcionario_id": funE.get("id"), "epi_id": epi.get("id"), "quantidade": q, "company_id": cid or cA,
            "responsavel_id": uA["id"], "numero_entrega": num, "numero_reposicao": num,
            "data_entrega": "2026-10-20 12:00:00.000Z", "hora_entrega": "08:00", "data_reposicao": "2026-10-20 12:00:00.000Z"}
    if col == "epis_entregas":
        body["foto_retirada"] = FOTO
    body.update(extra or {})
    return call("POST", f"/api/collections/{col}/records", tok or tA, body)
s, en1 = entrega(4)
check("epi", "Entrega de 4 baixa o estoque no servidor (10 -> 6)", s == 200 and epi_saldo(epi.get("id")) == 6, err(en1) if s >= 400 else f"saldo {epi_saldo(epi.get('id'))}")
s, rp = entrega(2, col="epis_reposicoes", extra={"tipo_reposicao": "Troca por desgaste"})
check("epi", "Reposição de 2 também baixa (6 -> 4)", s == 200 and epi_saldo(epi.get("id")) == 4, err(rp) if s >= 400 else f"saldo {epi_saldo(epi.get('id'))}")
s, r = entrega(1, extra={"foto_retirada": None})
check("foto", "Entrega de EPI sem a foto de quem recebe é recusada e o estoque não muda", s >= 400 and "foto" in r.get("message", "")
      and epi_saldo(epi.get("id")) == 4, r.get("message", "")[:80])
s, r = entrega(99)
check("epi", "Entrega maior que o estoque é recusada e nada muda", s >= 400 and "Estoque insuficiente" in r.get("message", "")
      and epi_saldo(epi.get("id")) == 4, r.get("message", "")[:80])
s, dv = call("POST", "/api/collections/epis_devolucoes/records", tA, {"entrega_id": en1.get("id"), "funcionario_id": funE.get("id"),
             "company_id": cA, "aprovado_reutilizacao": True, "responsavel_id": uA["id"], "numero_devolucao": "D-" + uuid.uuid4().hex[:6],
             "data_devolucao": "2026-10-20 12:00:00.000Z", "hora_devolucao": "17:00", "estado_epi": "Bom", "motivo": "fim da obra"})
ent = call("GET", f"/api/collections/epis_entregas/records/{en1.get('id')}", tA)[1]
check("epi", "Devolução aprovada para reutilizar volta ao estoque (4 -> 8) e a entrega fica Devolvido", s == 200
      and epi_saldo(epi.get("id")) == 8 and ent.get("situacao") == "Devolvido", err(dv) if s >= 400 else f"saldo {epi_saldo(epi.get('id'))}")
s, r = call("POST", "/api/collections/epis_devolucoes/records", tA, {"entrega_id": en1.get("id"), "funcionario_id": funE.get("id"),
            "company_id": cA, "aprovado_reutilizacao": True, "responsavel_id": uA["id"], "numero_devolucao": "D-" + uuid.uuid4().hex[:6],
             "data_devolucao": "2026-10-20 12:00:00.000Z", "hora_devolucao": "17:00", "estado_epi": "Bom", "motivo": "de novo"})
check("epi", "A mesma entrega não é devolvida duas vezes", s >= 400 and epi_saldo(epi.get("id")) == 8, r.get("message", "")[:60])
s, r = call("PATCH", f"/api/collections/epis/records/{epi.get('id')}", tPed, {"quantidade_estoque": 500})
check("epi", "Pedreiro não muda a quantidade do EPI por fora", epi_saldo(epi.get("id")) == 8, f"status {s} saldo {epi_saldo(epi.get('id'))}")
s, r = call("PATCH", f"/api/collections/epis/records/{epi.get('id')}", tA, {"quantidade_estoque": 12})
check("epi", "Gestão ajusta a quantidade (inventário)", s == 200 and epi_saldo(epi.get("id")) == 12, f"status {s}")
s, r = entrega(1, tok=tB, cid=cB)
check("permissao", "Empresa B não entrega EPI da Empresa A", s >= 400 and epi_saldo(epi.get("id")) == 12, f"status {s}")
s, r = entrega(1, extra={"assinatura_digital": "data:image/png;base64," + "A" * 40000})
check("epi", "Entrega com a assinatura desenhada (imagem grande) é salva", s == 200 and len(r.get("assinatura_digital", "")) > 40000
      and epi_saldo(epi.get("id")) == 11, err(r) if s >= 400 else "")

# ------------------------------------------------------------------ limite de tentativas de login (20/10/2026)
# O PocketBase já limita logins por IP (20 a cada 5 min). Para testar o limite POR CONTA sem
# esbarrar nele, o IP local fica fora do limite só nesta seção (restaurado no fim).
_rl = call("GET", "/api/settings", tSU)[1].get("rateLimits", {}) if tSU else {}
check("login", "Limite por IP do PocketBase está ligado (20 logins a cada 5 min)", _rl.get("enabled") is True
      and any(r.get("label") == "*:auth" for r in _rl.get("rules", [])), str(_rl.get("enabled")))
if tSU:
    call("PATCH", "/api/settings", tSU, {"rateLimits": {**_rl, "excludedIPs": ["127.0.0.1"]}})
s, ul = call("POST", "/api/collections/users/records", tA, {"email": "limite@teste.local", "username": "limiteteste", "password": "Senha12345",
             "passwordConfirm": "Senha12345", "company_id": cA, "cargo": "Pedreiro", "role": "Pedreiro", "status": "Ativo"})
def tenta(senha, ident="limite@teste.local"):
    return call("POST", "/api/collections/users/auth-with-password", body={"identity": ident, "password": senha})
for _ in range(3):
    tenta("errada")
s, r = tenta("Senha12345")
check("login", "Senha certa zera o contador de erros", s == 200, f"status {s}")
for _ in range(4):
    tenta("errada")
s, r = tenta("Senha12345")
check("login", "4 erros seguidos ainda deixam entrar", s == 200, f"status {s}")
for _ in range(5):
    s5, r5 = tenta("errada")
s, r = tenta("Senha12345")
check("login", "5 erros seguidos travam a conta (nem a senha certa entra)", s >= 400 and "Muitas tentativas" in r.get("message", ""), r.get("message", "")[:90])
s, r = call("POST", "/api/custom/login-usuario", None, {"username": "limiteteste", "password": "Senha12345"})
check("login", "Conta travada também não entra pela aba Usuário", s >= 400 and "Muitas tentativas" in r.get("message", ""), f"status {s}")
if tSU:
    call("PATCH", f"/api/collections/users/records/{ul.get('id')}", tSU, {"locked_until": "2020-01-01 00:00:00.000Z"})
    s, r = tenta("Senha12345")
    check("login", "Passado o tempo da trava, a senha certa volta a entrar", s == 200, f"status {s}")
    s, b = call("POST", "/api/collections/users/records", tA, {"email": "bloq@teste.local", "username": "bloqteste", "password": "Senha12345",
                "passwordConfirm": "Senha12345", "company_id": cA, "cargo": "Pedreiro", "role": "Pedreiro", "status": "Ativo"})
    call("PATCH", f"/api/collections/users/records/{b.get('id')}", tSU, {"status": "Bloqueado", "locked_until": "2126-01-01 00:00:00.000Z"})
    for _ in range(6):
        tenta("errada", "bloq@teste.local")
    s, r = call("GET", f"/api/collections/users/records/{b.get('id')}", tSU)
    check("login", "Bloqueio feito pelo administrador não é mexido pelo limite de tentativas", str(r.get("locked_until", "")).startswith("2126"), r.get("locked_until"))
    call("PATCH", "/api/settings", tSU, {"rateLimits": _rl})

# ------------------------------------------------------------------ login e recuperação de senha
s, r = call("POST", "/api/collections/users/auth-with-password", body={"identity": "adminb", "password": "Senha12345"})
check("telas", "Login pelo nome de usuário", s == 200 and r.get("record", {}).get("company_id") == cB, f"status {s}")
s, r = call("POST", "/api/custom/login-id", None, {"id_unico": uB.get("id_unico"), "password": "Senha12345"})
check("permissao", "Login pelo ID: mesmo ID e mesma senha em duas empresas é recusado (não entra na conta errada)",
      s >= 400 and "mais de uma empresa" in r.get("message", ""), f"status {s}")
if tSU:
    call("PATCH", f"/api/collections/users/records/{uB['id']}", tSU, {"password": "SenhaB12345", "passwordConfirm": "SenhaB12345"})
    s, r = call("POST", "/api/custom/login-id", None, {"id_unico": uB.get("id_unico"), "password": "SenhaB12345"})
    check("telas", "Login pelo ID curto (repetido entre empresas) entra na conta certa pela senha", s == 200 and r.get("record", {}).get("id") == uB["id"], f"status {s}")
s, r = call("POST", "/api/custom/login-id", None, {"id_unico": uB.get("id_unico"), "password": "errada"})
check("permissao", "Login pelo ID com senha errada é recusado", s >= 400, f"status {s}")
s1, _ = call("POST", "/api/custom/esqueci-senha", None, {"identificador": "a@teste.local"})
s2, _ = call("POST", "/api/custom/esqueci-senha", None, {"identificador": "ninguem@teste.local"})
check("permissao", "Esqueci minha senha responde igual com ou sem conta", s1 == 200 and s2 == 200)

# ------------------------------------------------------------------ dono do sistema como campo (Etapa 5)
# Antes o "Master" era o e-mail dnmltda@hotmail.com escrito nas regras; agora é users.dono_sistema.
if tSU:
    _cols = call("GET", "/api/collections?perPage=500", tSU)[1].get("items", [])
    _velhas = [c["name"] for c in _cols for k in ("listRule", "viewRule", "createRule", "updateRule", "deleteRule", "manageRule")
               if "dnmltda@hotmail.com" in str(c.get(k) or "")]
    check("permissao", "Nenhuma regra usa mais o e-mail fixo do Master", not _velhas, ", ".join(sorted(set(_velhas))))
call("PATCH", f"/api/collections/users/records/{uA['id']}", tA, {"dono_sistema": True})
s, r = call("GET", f"/api/collections/users/records/{uA['id']}", tA)
check("permissao", "Administrador da empresa não consegue se tornar dono do sistema", r.get("dono_sistema") is False, str(r.get("dono_sistema")))
s, r = call("POST", "/api/collections/users/records", tA, {"email": "falsodono@teste.local", "username": "falsodono", "password": "Senha12345",
            "passwordConfirm": "Senha12345", "company_id": cA, "cargo": "Pedreiro", "role": "Pedreiro", "status": "Ativo", "dono_sistema": True})
check("permissao", "Ninguém cria acesso já como dono do sistema", r.get("dono_sistema") is False, str(r.get("dono_sistema")))
s, r = call("GET", f"/api/collections/users/records?filter=company_id%3D%27{cA}%27", tB)
check("permissao", "Empresa B continua sem ver os usuários da Empresa A", s == 200 and r.get("totalItems") == 0, f"{r.get('totalItems')}")
if tSU:
    call("PATCH", f"/api/collections/users/records/{uB['id']}", tSU, {"dono_sistema": True})
    s, r = call("GET", f"/api/collections/users/records?filter=company_id%3D%27{cA}%27", login("b@teste.local", "SenhaB12345")[0])
    check("permissao", "Com o campo ligado pelo superusuário, o dono vê as outras empresas", s == 200 and r.get("totalItems", 0) > 0, f"{r.get('totalItems')}")
    call("PATCH", f"/api/collections/users/records/{uB['id']}", tSU, {"dono_sistema": False})

# ------------------------------------------------------------------ tabelas duplicadas sem uso (Etapa 5)
for _t in ("pedidos_compra", "solicitacoes_compra", "recebimentos", "veiculo"):
    s, r = call("POST", f"/api/collections/{_t}/records", tA, {"company_id": cA})
    check("permissao", f"Ninguém grava na tabela duplicada '{_t}' (o app usa a outra)", s >= 400, f"status {s}")

# ------------------------------------------------------------------ código de barras do material (21/10/2026)
s, cb1 = call("POST", "/api/collections/materiais/records", tA, {"name": "Cimento CP II (barras)", "unit": "sc", "category": "Materiais de Construção",
              "codigo_barras": " 7891234567895 ", "status": "active", "company_id": cA})
check("barras", "Material guarda o código de barras da embalagem (sem espaços)", s == 200 and cb1.get("codigo_barras") == "7891234567895", err(cb1) if s >= 400 else "")
s, r = call("POST", "/api/collections/materiais/records", tA, {"name": "Outro cimento", "unit": "sc", "category": "Materiais de Construção",
            "codigo_barras": "7891234567895", "status": "active", "company_id": cA})
check("barras", "O mesmo código de barras não vai para dois materiais da empresa", s >= 400 and "Cimento CP II" in r.get("message", ""), r.get("message", "")[:90])
_tB2 = login("b@teste.local", "SenhaB12345")[0] if tSU else tB  # a senha da B mudou mais acima
s, r = call("POST", "/api/collections/materiais/records", _tB2, {"name": "Cimento da B", "unit": "sc", "category": "Materiais de Construção",
            "codigo_barras": "7891234567895", "status": "active", "company_id": cB})
check("barras", "Outra empresa pode usar o mesmo código de barras", s == 200, err(r) if s >= 400 else "")
s, r = call("GET", "/api/collections/materiais/records?filter=" + q('codigo_barras="7891234567895"'), tA)
check("barras", "A busca pelo código de barras acha só o material da própria empresa", r.get("totalItems") == 1 and r["items"][0]["id"] == cb1.get("id"), f"{r.get('totalItems')}")

# ------------------------------------------------------------------ quem muda o quê nos dados das pessoas (21/10/2026)
tPerf = usuario("perfil@teste.local", "Servente")
_uPerf = call("POST", "/api/collections/users/auth-with-password", body={"identity": "perfil@teste.local", "password": "Senha12345"})[1]["record"]
s, eu = call("PATCH", f"/api/collections/users/records/{_uPerf['id']}", tPerf, {"telefone": "(11) 98888-0000", "username": "funcnovo",
             "email": "outro@teste.local", "name": "Nome Trocado"})
check("dados", "Meu Perfil: a pessoa muda telefone e nome de login", s == 200 and eu.get("telefone") == "(11) 98888-0000" and eu.get("username") == "funcnovo", err(eu) if s >= 400 else "")
_eu = call("GET", f"/api/collections/users/records/{_uPerf['id']}", tA)[1]
check("dados", "Meu Perfil: e-mail e nome completo não mudam pela própria pessoa", _eu.get("email") == "perfil@teste.local" and _eu.get("name") != "Nome Trocado",
      str({k: _eu.get(k) for k in ("email", "name")}))
s, r = call("PATCH", f"/api/collections/users/records/{_uPerf['id']}", tPerf, {"id_unico": "999", "cargo": "Administrador"})
_eu = call("GET", f"/api/collections/users/records/{_uPerf['id']}", tA)[1]
check("dados", "Meu Perfil: pedido para mudar o próprio ID ou cargo é recusado", s >= 400 and _eu.get("cargo") == "Servente" and _eu.get("id_unico") != "999", f"status {s}")
s, eu = call("PATCH", f"/api/collections/users/records/{uA['id']}", tA, {"telefone": "(11) 97777-0000", "email": "trocado@teste.local"})
check("dados", "Nem o administrador muda o próprio e-mail", s == 200 and eu.get("email") != "trocado@teste.local", f"status {s}")
s, fx = call("POST", "/api/collections/funcionarios/records", tA, {"matricula": "M-DADOS", "nome": "Cadastro Teste", "nome_completo": "Cadastro Teste",
             "cargoId": cargo1, "cpf": "111.222.333-44", "company_id": cA})
s, r = call("PATCH", f"/api/collections/funcionarios/records/{fx.get('id')}", tPed, {"cpf": "999.999.999-99"})
check("dados", "Pedreiro não altera o cadastro de outro funcionário (CPF)", s >= 400, f"status {s}")
s, r = call("POST", "/api/collections/funcionarios/records", tPed, {"matricula": "M-PED", "nome": "Fantasma", "nome_completo": "Fantasma", "cargoId": cargo1, "company_id": cA})
check("dados", "Pedreiro não cadastra funcionário", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/funcionarios/records/{fx.get('id')}", tEng, {"cpf": "999.999.999-99", "obraId": obra.get("id")})
_fx = call("GET", f"/api/collections/funcionarios/records/{fx.get('id')}", tA)[1]  # o engenheiro não recebe o CPF; confere pelo administrador
check("dados", "Engenheiro coloca na obra, mas não muda o CPF", s == 200 and r.get("obraId") == obra.get("id") and _fx.get("cpf") == "111.222.333-44", err(r) if s >= 400 else _fx.get("cpf"))
s, r = call("PATCH", f"/api/collections/funcionarios/records/{fx.get('id')}", tA, {"telefone": "(11) 96666-0000"})
check("dados", "Administrador edita o cadastro do funcionário", s == 200 and r.get("telefone") == "(11) 96666-0000", err(r) if s >= 400 else "")

# ------------------------------------------------------------------ titular protegido e limites das empresas de teste (21/10/2026)
s, r = call("POST", "/api/custom/self-register-company", None, {"companyName": "Empresa Limite", "adminName": "Admin L", "adminEmail": "l@teste.local",
            "username": "adminl", "password": "Senha12345"})
tL, uL = login("l@teste.local")
cL = uL["company_id"]
_emp = call("GET", f"/api/collections/companies/records/{cL}", tL)[1]
check("limites", "Empresa nova do cadastro nasce com os limites de teste (10 logins, 30 funcionários, 300 materiais, 5 obras)",
      [_emp.get(k) for k in ("limite_usuarios", "limite_funcionarios", "limite_materiais", "limite_obras")] == [10, 30, 300, 5], str(_emp.get("limite_obras")))
for i in range(5):
    call("POST", "/api/collections/obras/records", tL, {"nome": f"Obra L{i}", "company_id": cL})
s, r = call("POST", "/api/collections/obras/records", tL, {"nome": "Obra L6", "company_id": cL})
check("limites", "A 6ª obra da empresa de teste é recusada com aviso claro", s >= 400 and "limite de 5 obras" in r.get("message", ""), r.get("message", "")[:90])
s, r = call("PATCH", f"/api/collections/companies/records/{cL}", tL, {"limite_obras": 100})
check("limites", "O administrador da empresa de teste não aumenta o próprio limite",
      call("GET", f"/api/collections/companies/records/{cL}", tL)[1].get("limite_obras") == 5, f"status {s}")
if tSU:
    _dono = call("GET", "/api/collections/users/records?filter=" + q("dono_sistema=true"), tSU)[1].get("items", [{}])[0]
    _cD = _dono.get("company_id")
    call("POST", "/api/collections/users/records", tSU, {"email": "admdnm@teste.local", "username": "admdnm", "password": "Senha12345",
         "passwordConfirm": "Senha12345", "company_id": _cD, "cargo": "Administrador", "role": "Administrador", "status": "Ativo"})
    tD = login("admdnm@teste.local")[0]
    s1, _ = call("PATCH", f"/api/collections/users/records/{_dono['id']}", tD, {"status": "Inativo"})
    s2, _ = call("DELETE", f"/api/collections/users/records/{_dono['id']}", tD)
    s3, _ = call("PATCH", f"/api/collections/users/records/{_dono['id']}", tD, {"cargo": "Servente", "role": "Servente"})
    _d2 = call("GET", f"/api/collections/users/records/{_dono['id']}", tSU)[1]
    check("titular", "Outro administrador não inativa, não apaga nem rebaixa o titular",
          s1 >= 400 and s2 >= 400 and s3 >= 400 and _d2.get("status") == "Ativo" and _d2.get("cargo") == "Administrador" and not _d2.get("deleted_at"),
          f"{s1} {s2} {s3}")
    _tk = str(uuid.uuid4())
    s4, r4 = call("PATCH", f"/api/collections/users/records/{_dono['id']}", tD, {"password_reset_token": _tk, "password_reset_expires": "2099-01-01 00:00:00.000Z"})
    s5, r5 = call("POST", "/api/custom/activate-invite", None, {"token": _tk, "password": "Invasor12345", "passwordConfirm": "Invasor12345"})
    check("titular", "Outro administrador não grava convite na conta do titular (não toma a conta)", s4 == 403 and s5 >= 400, f"gravar {s4}, ativar {s5}")
    s6, _ = call("PATCH", f"/api/collections/users/records/{_dono['id']}", tD, {"email": "invasor@teste.local"})
    check("titular", "Outro administrador não troca o e-mail do titular", s6 == 403, f"status {s6}")
    s7, _ = call("POST", "/api/custom/esqueci-senha", None, {"identificador": _dono.get("email")})
    check("titular", "O titular continua podendo pedir \"Esqueci minha senha\"", s7 == 200, f"status {s7}")
    s, _ = call("DELETE", f"/api/collections/users/records/{_dono['id']}", tSU)
    check("titular", "Nem o superusuário apaga a conta do titular", s >= 400 and call("GET", f"/api/collections/users/records/{_dono['id']}", tSU)[0] == 200, f"status {s}")
    s, _ = call("DELETE", f"/api/collections/companies/records/{_cD}", tSU)
    check("titular", "A empresa do titular não pode ser apagada", s >= 400, f"status {s}")

# ------------------------------------------------------------------ quem recebe o quê do servidor (G1, 22/10/2026)
_cg = (call("GET", "/api/collections/cargos/records?perPage=1", tA)[1].get("items") or [{}])[0].get("id", "")
s, _fg = call("POST", "/api/collections/funcionarios/records", tA, {"matricula": "M-G1", "nome": "Sigiloso", "nome_completo": "Sigiloso da Silva",
              "cpf": "987.654.321-00", "salario": 4200, "cargoId": _cg, "company_id": cA})
call("POST", "/api/collections/contas_pagar/records", tA, {"descricao": "Aluguel G1", "valor": 5000, "data_vencimento": "2026-11-10 12:00:00", "company_id": cA})
call("POST", "/api/collections/clientes/records", tA, {"nome": "Cliente G1", "company_id": cA})
call("POST", "/api/collections/materiais/records", tA, {"name": "Material G1", "unit": "un", "category": "Outros", "unit_cost": 99.9, "status": "active", "company_id": cA})
_tok = {c: usuario(f"g1.{c.lower().replace(' ', '')}@teste.local", c) for c in ("Cliente", "Servente", "Financeiro", "Almoxarife", "RH", "Engenheiro")}
def _lista(tok, col, filtro=""):
    s, r = call("GET", f"/api/collections/{col}/records?perPage=200" + ("&filter=" + q(filtro) if filtro else ""), tok)
    return r.get("items", []) if s == 200 else []
for c in ("Cliente", "Servente"):
    vis = {col: len(_lista(_tok[c], col)) for col in ("contas_pagar", "clientes", "compras", "fornecedores", "documentos")}
    check("g1", f"{c} não recebe contas, clientes, compras, fornecedores nem documentos", not any(vis.values()), str(vis))
    f = next((x for x in _lista(_tok[c], "funcionarios") if x.get("id") == _fg.get("id")), {})
    check("g1", f"{c} vê o colega, mas sem CPF nem salário", f.get("nome_completo") == "Sigiloso da Silva" and "cpf" not in f and "salario" not in f, str(sorted(f))[:120])
    m = next((x for x in _lista(_tok[c], "materiais") if x.get("name") == "Material G1"), {})
    check("g1", f"{c} não recebe o custo do material", m and "unit_cost" not in m, str(m.get("unit_cost")))
check("g1", "Financeiro lê as contas a pagar", any(x.get("descricao") == "Aluguel G1" for x in _lista(_tok["Financeiro"], "contas_pagar")))
check("g1", "Almoxarife lê compras e fornecedores (e não as contas)", s == 200 and not _lista(_tok["Almoxarife"], "contas_pagar")
      and call("GET", "/api/collections/compras/records?perPage=1", _tok["Almoxarife"])[0] == 200)
_f = lambda t: next((x for x in _lista(t, "funcionarios") if x.get("id") == _fg.get("id")), {})
check("g1", "RH vê CPF e salário do funcionário", _f(_tok["RH"]).get("cpf") == "987.654.321-00" and _f(_tok["RH"]).get("salario") == 4200)
check("g1", "Engenheiro vê o funcionário sem CPF nem salário", _f(_tok["Engenheiro"]) and "salario" not in _f(_tok["Engenheiro"]))
check("g1", "Administrador continua vendo tudo", _f(tA).get("salario") == 4200 and any(x.get("descricao") == "Aluguel G1" for x in _lista(tA, "contas_pagar")))
check("g1", "Empresa B continua sem ver nada da A", not _lista(login("b@teste.local", "SenhaB12345")[0] if tSU else tB, "funcionarios", f'id="{_fg.get("id")}"'))

# ------------------------------------------------------------------ A5: busca, tempo real e dados vinculados (24/10/2026)
def _busca(tok, col, filtro):
    return call("GET", f"/api/collections/{col}/records?perPage=5&filter=" + q(filtro), tok)
s, r = _busca(_tok["Servente"], "funcionarios", "salario>1000")
check("a5", "Servente não busca funcionário por salário", s == 400 and "buscar" in r.get("message", ""), f"status {s}")
s, r = _busca(_tok["Servente"], "funcionarios", 'cpf~"987"')
check("a5", "Servente não busca funcionário por CPF", s == 400, f"status {s}")
s, r = call("GET", "/api/collections/materiais/records?perPage=5&sort=-unit_cost", _tok["Servente"])
check("a5", "Servente não ordena material pelo custo", s == 400, f"status {s}")
s, r = _busca(_tok["RH"], "funcionarios", "salario>1000")
check("a5", "RH continua buscando funcionário por salário", s == 200 and any(x.get("id") == _fg.get("id") for x in r.get("items", [])), f"status {s}")
s, r = _busca(_tok["Servente"], "funcionarios", 'nome~"Sigiloso"')
check("a5", "Servente continua buscando funcionário pelo nome", s == 200 and r.get("items"), f"status {s}")
s, fx = call("POST", "/api/collections/fornecedores/records", tA, {"nome": "Fornecedor Sigiloso", "cnpj": "11222333000181", "company_id": cA})
s2, ex = call("POST", "/api/collections/equipamentos/records", tA, {"nome": "Martelete A5", "company_id": cA, "fornecedor_id": fx.get("id")})
check("a5", "(preparo) equipamento com fornecedor", s == 200 and s2 == 200 and ex.get("fornecedor_id"), err(fx) if s >= 400 else (err(ex) if s2 >= 400 else ""))
s, r = call("GET", f"/api/collections/equipamentos/records/{ex.get('id')}?expand=fornecedor_id", _tok["Servente"])
_fx = (r.get("expand") or {}).get("fornecedor_id") or {}
check("a5", "Servente abre o equipamento, mas o fornecedor vem sem dados", s == 200 and "nome" not in _fx, f"status {s} {sorted(_fx)[:4]}")
s, r = call("GET", f"/api/collections/equipamentos/records/{ex.get('id')}?expand=fornecedor_id", _tok["Almoxarife"])
check("a5", "Almoxarife vê o fornecedor do equipamento", ((r.get("expand") or {}).get("fornecedor_id") or {}).get("nome") == "Fornecedor Sigiloso", f"status {s}")

import http.client, threading, time as _time
def _escuta(tok, topicos, acao, espera=3.0):
    """Abre o tempo real, inscreve nos tópicos, executa a ação e devolve os eventos recebidos."""
    u = urllib.parse.urlparse(B)
    cx = http.client.HTTPConnection(u.hostname, u.port, timeout=espera + 5)
    cx.request("GET", "/api/realtime")
    resp = cx.getresponse()
    eventos, cid = [], [None]
    def ler():
        nome = ""
        try:
            while True:
                linha = resp.fp.readline().decode()
                if not linha:
                    break
                if linha.startswith("event:"):
                    nome = linha[6:].strip()
                elif linha.startswith("data:"):
                    d = json.loads(linha[5:].strip() or "{}")
                    if nome == "PB_CONNECT":
                        cid[0] = d.get("clientId")
                    else:
                        eventos.append(nome)
        except Exception:
            pass
    th = threading.Thread(target=ler, daemon=True)
    th.start()
    for _ in range(50):
        if cid[0]:
            break
        _time.sleep(0.1)
    call("POST", "/api/realtime", tok, {"clientId": cid[0], "subscriptions": topicos})
    _time.sleep(0.5)
    acao()
    _time.sleep(espera)
    cx.close()
    return eventos
_ev = _escuta(_tok["Servente"], ["contas_pagar/*", "obras/*"], lambda: (
    call("POST", "/api/collections/contas_pagar/records", tA, {"descricao": "Conta tempo real", "valor": 10, "data_vencimento": "2026-11-10 12:00:00", "company_id": cA}),
    call("POST", "/api/collections/obras/records", tA, {"nome": "Obra tempo real", "company_id": cA})))
check("a5", "Tempo real: Servente não recebe contas a pagar (e continua recebendo obras)", "contas_pagar/*" not in _ev and "obras/*" in _ev, str(_ev))
_ev = _escuta(_tok["Financeiro"], ["contas_pagar/*"], lambda: call("POST", "/api/collections/contas_pagar/records", tA,
              {"descricao": "Conta tempo real 2", "valor": 10, "data_vencimento": "2026-11-10 12:00:00", "company_id": cA}))
check("a5", "Tempo real: Financeiro continua recebendo contas a pagar", "contas_pagar/*" in _ev, str(_ev))

# ------------------------------------------------------------------ A2/A4: empresa travada nas gravações (24/10/2026)
_tBv = _tB2  # a senha da B mudou mais acima: o token antigo não vale
s, matB = call("POST", "/api/collections/materiais/records", _tBv, {"name": "Material da B", "code": "TST-B-1", "unit": "un", "company_id": cB})
check("empresa", "(preparo) Empresa B cadastra um material", s == 200, err(matB) if s >= 400 else "")
s1, r1 = mov("Entrada", 1, material_id=matB.get("id"))
check("empresa", "A não lança movimentação com material da empresa B", s1 >= 400 and "outra empresa" in r1.get("message", ""), f"status {s1} {r1.get('message', '')[:60]}")
s2, r2 = call("POST", "/api/collections/movimentacoes/records", _tBv, {"material_id": mid, "company_id": cB, "tipo": "Saída", "quantidade": 1,
              "status": "Aprovado", "data": "2026-10-18", "criado_por": uB["id"]})
check("empresa", "B não lança movimentação com material da empresa A (outro sentido)", s2 >= 400, f"status {s2} {r2.get('message', '')[:60]}")
s3, r3 = mov("Entrada", 1)
check("empresa", "Movimentação com material da própria empresa continua aceita", s3 == 200, err(r3) if s3 >= 400 else "")
s, r = call("PATCH", f"/api/collections/obras/records/{obra.get('id')}", tA, {"company_id": cB})
check("empresa", "Editar não troca a empresa da obra", s >= 400 and "não pode ser trocada" in r.get("message", "") and
      call("GET", f"/api/collections/obras/records/{obra.get('id')}", tA)[1].get("company_id") == cA, f"status {s}")
s, r = call("PATCH", f"/api/collections/materiais/records/{mid}", tA, {"company_id": cB})
check("empresa", "Editar não troca a empresa do material", s >= 400, f"status {s}")
s, r = call("PATCH", f"/api/collections/obras/records/{obra.get('id')}", tA, {"nome": obra.get("nome") or "Obra A"})
check("empresa", "Editar a obra sem mexer na empresa continua aceito", s == 200, err(r) if s >= 400 else "")
s, eqA = call("POST", "/api/collections/equipamentos/records", tA, {"nome": "Betoneira trava", "company_id": cA})
s, r = call("PATCH", f"/api/collections/equipamentos/records/{eqA.get('id')}", tA, {"obra_atual_id": obraB.get("id")})
check("empresa", "Equipamento não vai para obra de outra empresa", s >= 400 and "outra empresa" in r.get("message", ""), f"status {s}")
s, r = call("PATCH", f"/api/collections/equipamentos/records/{eqA.get('id')}", tA, {"obra_atual_id": obra.get("id")})
check("empresa", "Equipamento vai para obra da própria empresa", s == 200, err(r) if s >= 400 else "")

# ------------------------------------------------------------------ A3: gravação por cargo no servidor (24/10/2026)
# Antes qualquer pessoa da empresa criava/alterava qualquer tabela pela API. Agora só quem tem a tela.
# "Recusado" = 403 com a mensagem do servidor; "aceito" = não é 403 (pode faltar campo obrigatório: 400).
if tSU:
    _rl3 = call("GET", "/api/settings", tSU)[1].get("rateLimits", {})
    call("PATCH", "/api/settings", tSU, {"rateLimits": {**_rl3, "excludedIPs": ["127.0.0.1"]}})
_GR = {
    "contas_pagar": ["Financeiro", "Gerência"],
    "compras": ["Almoxarife", "Comprador", "Financeiro", "Engenheiro", "Gerência", "Mestre de Obras"],
    "fornecedores": ["Almoxarife", "Comprador", "Financeiro", "Engenheiro", "Gerência", "Mestre de Obras"],
    "clientes": ["Gerência"],
    "obras": ["Engenheiro", "Gerência", "Mestre de Obras", "Almoxarife"],
    "equipamentos": ["Almoxarife", "Engenheiro", "Gerência", "Mestre de Obras"],
    "epis": ["Almoxarife", "RH", "Gerência", "Mestre de Obras"],
    "veiculos": ["Engenheiro", "Gerência", "Mestre de Obras"],
    "documentos_central": ["Engenheiro", "RH", "Gerência"],
    "treinamentos": ["RH", "Gerência"],
    "perdas_ganhos": ["Almoxarife", "Engenheiro", "Gerência", "Mestre de Obras"],
}
_C3 = ["Pedreiro", "Cliente", "Funcionário", "Financeiro", "Almoxarife", "Comprador", "RH", "Engenheiro", "Mestre de Obras", "Gerência"]
_t3 = {c: usuario(f"a3.{c.lower().replace(' ', '').replace('ê', 'e').replace('á', 'a')}@teste.local", c) for c in _C3}
_reg = {}
for col in _GR:
    s, r = call("POST", f"/api/collections/{col}/records", tA, {"company_id": cA})
    _reg[col] = r.get("id") if s == 200 else None
for col, quem in _GR.items():
    erros = []
    for c in _C3:
        s, r = call("POST", f"/api/collections/{col}/records", _t3[c], {"company_id": cA})
        su_ = call("PATCH", f"/api/collections/{col}/records/{_reg[col]}", _t3[c], {})[0] if _reg[col] else None
        negado = s == 403 and "permissão" in r.get("message", "")
        if (c in quem) == negado or (su_ is not None and (c in quem) == (su_ == 403)):
            erros.append(f"{c}: criar {s}, alterar {su_}")
    check("a3", f"{col}: só {', '.join(quem)} (e o administrador) criam e alteram pela API", not erros, "; ".join(erros)[:200])
s, r = call("POST", "/api/collections/contas_pagar/records", tA, {"company_id": cA})
check("a3", "Administrador continua gravando em contas a pagar", s != 403, f"status {s}")
s, r = call("POST", "/api/collections/cargos/records", tA, {"nome": "Cargo Inventado"})
check("a3", "Administrador de empresa não cria cargo no catálogo comum (só o titular)", s >= 400, f"status {s}")
if tSU:
    call("PATCH", "/api/settings", tSU, {"rateLimits": _rl3})

# ------------------------------------------------------------------ C1: conta Inativa ou Bloqueada não entra (24/10/2026)
# Antes o bloqueio existia só na tela. Agora o servidor recusa nas 3 formas de login e
# derruba as sessões abertas de quem foi inativado.
if tSU:
    _rl = call("GET", "/api/settings", tSU)[1].get("rateLimits", {})
    call("PATCH", "/api/settings", tSU, {"rateLimits": {**_rl, "excludedIPs": ["127.0.0.1"]}})
    s, _sit = call("POST", "/api/collections/users/records", tA, {"email": "situacao@teste.local", "username": "situacaoteste", "password": "Senha12345",
                   "passwordConfirm": "Senha12345", "company_id": cA, "cargo": "Pedreiro", "role": "Pedreiro", "status": "Ativo"})
    _idu = call("GET", f"/api/collections/users/records/{_sit.get('id')}", tSU)[1].get("id_unico", "")
    def _entra(como):
        if como == "e-mail":
            return call("POST", "/api/collections/users/auth-with-password", body={"identity": "situacao@teste.local", "password": "Senha12345"})
        if como == "usuário":
            return call("POST", "/api/custom/login-usuario", None, {"username": "situacaoteste", "password": "Senha12345"})
        return call("POST", "/api/custom/login-id", None, {"id_unico": _idu, "password": "Senha12345"})
    s, r = _entra("e-mail")
    _tsit = r.get("token")
    check("situacao", "Conta Ativa entra normalmente", s == 200 and _tsit, f"status {s}")
    check("situacao", "Sessão da conta Ativa lê os dados", call("GET", "/api/collections/obras/records?perPage=1", _tsit)[0] == 200)
    s, _ = call("PATCH", f"/api/collections/users/records/{_sit.get('id')}", tA, {"status": "Inativo"})
    check("situacao", "Administrador inativa o usuário", s == 200, f"status {s}")
    s, r = call("GET", "/api/collections/obras/records?perPage=1", _tsit)
    s2, _ = call("POST", "/api/collections/users/auth-refresh", _tsit)
    check("situacao", "Sessão aberta antes de inativar deixa de valer (leitura e renovação)", s == 401 or (s == 200 and not r.get("items") and s2 >= 400), f"leitura {s}, renovação {s2}")
    for como in ("e-mail", "usuário", "ID"):
        s, r = _entra(como)
        check("situacao", f"Conta Inativa não entra pelo login por {como}", s >= 400 and "inativo" in r.get("message", "").lower(), f"status {s} {r.get('message', '')[:70]}")
    call("PATCH", f"/api/collections/users/records/{_sit.get('id')}", tA, {"status": "Bloqueado"})
    for como in ("e-mail", "usuário", "ID"):
        s, r = _entra(como)
        check("situacao", f"Conta Bloqueada não entra pelo login por {como}", s >= 400 and "bloqueado" in r.get("message", "").lower(), f"status {s} {r.get('message', '')[:70]}")
    call("PATCH", f"/api/collections/users/records/{_sit.get('id')}", tA, {"status": "Ativo"})
    s, r = _entra("e-mail")
    check("situacao", "Conta reativada volta a entrar", s == 200, f"status {s}")
    s, _ = call("DELETE", f"/api/collections/users/records/{_sit.get('id')}", tA)
    s2, r2 = _entra("e-mail")
    check("situacao", "Usuário excluído (inativado) não entra mais", s == 204 and s2 >= 400, f"excluir {s}, login {s2}")
    _dn = call("GET", "/api/collections/users/records?filter=" + q("dono_sistema=true"), tSU)[1].get("items", [{}])[0]
    if _dn.get("id"):
        call("PATCH", f"/api/collections/users/records/{_dn['id']}", tSU, {"password": "Senha12345", "passwordConfirm": "Senha12345"})
        s, r = call("POST", "/api/collections/users/auth-with-password", body={"identity": _dn.get("email"), "password": "Senha12345"})
        check("situacao", "Titular continua entrando", s == 200, f"status {s}")
    call("PATCH", "/api/settings", tSU, {"rateLimits": _rl})

print("\nRESUMO:", sum(1 for x in results if x["ok"]), "OK /", sum(1 for x in results if not x["ok"]), "FALHA")
json.dump(results, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
