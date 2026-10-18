"""Testes de regressão do servidor do APP OBRA.

Rodam contra um PocketBase LOCAL e isolado (ver README.md), nunca contra
produção. Pré-requisito: empresas "Empresa A" (a@teste.local) e "Empresa B"
(b@teste.local) criadas pelo autocadastro, senha Senha12345.

Uso: python3 -I audit_tests.py resultado.json
"""
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


def call(method, path, token=None, body=None):
    req = urllib.request.Request(B + path, method=method)
    req.add_header("content-type", "application/json")
    if token:
        req.add_header("Authorization", token)
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
check("telas", "Materiais: empresa nova já nasce com catálogo", mats.get("totalItems", 0) > 0, f"{mats.get('totalItems')} materiais")
mat = (mats.get("items") or [None])[0]
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
s, inv = mov("Inventário", 30, observacoes="Contagem do mês")
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

print("\nRESUMO:", sum(1 for x in results if x["ok"]), "OK /", sum(1 for x in results if not x["ok"]), "FALHA")
json.dump(results, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
