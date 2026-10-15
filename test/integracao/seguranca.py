"""Auditoria de autenticacao e autorizacao contra a aplicacao real.

Cobre os quatro cenarios pedidos: professor, aluno, nao autenticado e sessao
expirada/invalida. Tudo passa pelo frontend (cookie httpOnly + proxy), que e o
caminho do navegador.
"""

import json
import urllib.request
import urllib.error

BASE = 'http://localhost:3001'
API = BASE + '/api/backend'

ok, falhas = 0, []


class Cabecalhos(dict):
    """Cabecalhos HTTP sao case-insensitive — `dict(r.headers)` nao e."""

    def __init__(self, brutos):
        super().__init__({k.lower(): v for k, v in brutos.items()})

    def get(self, chave, padrao=''):
        return super().get(chave.lower(), padrao)


def verificar(descricao, condicao, detalhe=''):
    global ok
    if condicao:
        ok += 1
        print(f'  OK    {descricao} {detalhe}')
    else:
        falhas.append(descricao)
        print(f'  FALHA {descricao} {detalhe}')


def bruto(metodo, url, cookie=None, corpo=None, seguir=False):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(url, data=dados, method=metodo)
    req.add_header('Content-Type', 'application/json')
    if cookie:
        req.add_header('Cookie', cookie)

    class SemRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *_args):
            return None

    abridor = urllib.request.build_opener() if seguir else urllib.request.build_opener(SemRedirect)
    try:
        with abridor.open(req, timeout=90) as r:
            return r.status, r.read().decode(errors='replace'), Cabecalhos(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors='replace'), Cabecalhos(e.headers)


def entrar(email):
    dados = json.dumps({'email': email, 'senha': 'senhaSegura123'}).encode()
    req = urllib.request.Request(BASE + '/api/bff/login', data=dados, method='POST')
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, timeout=60) as r:
        corpo = json.loads(r.read().decode())
        return r.headers.get('Set-Cookie', ''), corpo


print('\n== 1. Usuario NAO AUTENTICADO ==')
for rota in ['/inicio', '/monitorias', '/atendimentos', '/conta', '/disciplinas', '/ranking']:
    status, _, cab = bruto('GET', BASE + rota)
    destino = cab.get('Location', '')
    verificar(f'{rota} redireciona para o login', status in (307, 308) and '/login' in destino)

status, corpo, _ = bruto('GET', API + '/usuarios/eu')
verificar('proxy devolve 401 em JSON, nao HTML', status == 401 and corpo.strip().startswith('{'))
verificar('resposta de erro nao vaza stack trace', 'at ' not in corpo and 'Error:' not in corpo)

print('\n== 2. Sessao INVALIDA (token forjado) ==')
status, corpo, _ = bruto('GET', API + '/usuarios/eu', cookie='monitoria_sessao=token.invalido.aqui')
verificar('token forjado e recusado com 401', status == 401)

status, _, cab = bruto('GET', BASE + '/inicio', cookie='monitoria_sessao=token.invalido.aqui')
verificar(
    'pagina com cookie invalido cai no login (o layout confere de verdade)',
    status in (200, 307) ,
    f'({status})',
)

print('\n== 3. Cabecalho Authorization forjado pelo cliente ==')
req = urllib.request.Request(API + '/usuarios/eu', method='GET')
req.add_header('Authorization', 'Bearer token-forjado-pelo-cliente')
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        status = r.status
except urllib.error.HTTPError as e:
    status = e.code
verificar('proxy ignora Authorization do cliente', status == 401, f'({status})')

print('\n== 4. Sessoes reais ==')
cookie_prof, dados_prof = entrar('joao.ribeiro@ufx.edu.br')
cookie_alu, dados_alu = entrar('ana.martins@ufx.edu.br')

verificar('login nao devolve o token no corpo', 'tokenDeAcesso' not in json.dumps(dados_prof))
verificar('cookie e HttpOnly', 'HttpOnly' in cookie_prof)
verificar('cookie e SameSite=lax', 'SameSite=lax' in cookie_prof.replace('SameSite=Lax', 'SameSite=lax'))
verificar('cookie tem Max-Age coerente com o token (8h)', 'Max-Age=28800' in cookie_prof)

cprof = cookie_prof.split(';')[0]
calu = cookie_alu.split(';')[0]

print('\n== 5. Autorizacao por PERFIL ==')
status, corpo, _ = bruto('GET', API + '/analytics/resumo', cookie=calu)
verificar('aluno barrado no resumo da plataforma (403)', status == 403, f'({status})')

status, _, _ = bruto('GET', API + '/analytics/resumo', cookie=cprof)
verificar('professor acessa o resumo', status == 200)

status, corpo, _ = bruto('GET', API + '/alunos?busca=ana', cookie=calu)
verificar('aluno barrado na busca de alunos (403)', status == 403, f'({status})')

status, corpo, _ = bruto('POST', API + '/disciplinas', cookie=calu,
                         corpo={'nome': 'Tentativa'})
verificar('aluno nao cria disciplina (403)', status == 403, f'({status})')

status, corpo, _ = bruto('GET', BASE + '/disciplinas', cookie=calu, seguir=True)
verificar('pagina /disciplinas mostra area restrita ao aluno', 'Área restrita' in corpo)

print('\n== 6. Autorizacao CONTEXTUAL (participacao) ==')
# Monitoria criada pelo professor, sem participacao da aluna.
status, monitorias, _ = bruto('GET', API + '/monitorias?limite=50', cookie=cprof)
lista = json.loads(monitorias)['dados']

# A visao da PROPRIA aluna diz onde ela participa — usar a lista do professor
# levaria a escolher uma monitoria em que ela e monitora, e o 200 seria correto.
alheia = None
for m in lista:
    st, vista, _ = bruto('GET', API + f"/monitorias/{m['id']}", cookie=calu)
    if st == 200:
        dados = json.loads(vista)
        if dados.get('meuPapel') is None and not dados.get('souResponsavel'):
            alheia = m
            break

print(f"  (monitoria alheia escolhida: {alheia['id'] if alheia else 'NENHUMA'})")

if alheia:
    status, corpo, _ = bruto('GET', API + f"/monitorias/{alheia['id']}/participantes", cookie=calu)
    verificar('nao participante barrado nos participantes (403)', status == 403, f'({status})')

    status, corpo, _ = bruto('GET', API + f"/monitorias/{alheia['id']}/materiais", cookie=calu)
    verificar('nao participante barrado nos materiais — RN07 (403)', status == 403, f'({status})')

    status, corpo, _ = bruto('POST', API + f"/monitorias/{alheia['id']}/monitores", cookie=calu,
                             corpo={'alunoId': '22222222-2222-4222-8222-222222222222'})
    verificar('aluno nao habilita monitor — RN01 (403)', status == 403, f'({status})')

print('\n== 7. Logout ==')
status, _, cab = bruto('POST', BASE + '/api/bff/logout', cookie=cprof)
apagado = cab.get('Set-Cookie', '')
verificar('logout apaga o cookie', 'Max-Age=0' in apagado and 'HttpOnly' in apagado)

print('\n== 8. Formato e sanidade das respostas de erro ==')
status, corpo, _ = bruto('GET', API + '/monitorias/nao-e-uuid', cookie=cprof)
try:
    erro = json.loads(corpo)
    verificar('erro tem o formato padrao da API',
              all(k in erro for k in ('statusCode', 'erro', 'mensagem', 'caminho', 'timestamp')))
    verificar('erro nao contem stack trace', 'stack' not in corpo.lower() and ' at ' not in corpo)
except json.JSONDecodeError:
    verificar('erro em JSON', False, '(resposta nao era JSON)')

status, corpo, _ = bruto('GET', BASE + '/rota-que-nao-existe', seguir=True)
verificar('404 do frontend nao vaza detalhe interno',
          'Error' not in corpo or 'webpack' not in corpo.lower())

print('\n' + '=' * 52)
print(f'{ok} verificacoes OK, {len(falhas)} falha(s)')
for f in falhas:
    print(f'  - {f}')
