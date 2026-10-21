"""Editais e inscricoes, ATRAVES do frontend (proxy /api/backend).

Exercita o que as telas consomem, pelo mesmo caminho do navegador — incluindo o
UPLOAD do boletim em multipart, que e a parte mais fragil da integracao: o
proxy precisa repassar bytes, nao texto.

Uso:  py -I test/integracao/editais.py     (frontend em 3001, backend em 3000)

ATENCAO — BANCO DESCARTAVEL. Este script CRIA edital, curso, disciplina e
inscricoes (que disparam e-mail de confirmacao). Rode apenas contra um banco de
desenvolvimento.
"""

import json
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import date, timedelta

BASE = 'http://localhost:3001'
API = BASE + '/api/backend'

ok = 0
falhas = []


def chamar(metodo, url, cookie=None, corpo=None):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(url, data=dados, method=metodo)
    req.add_header('Content-Type', 'application/json')
    if cookie:
        req.add_header('Cookie', cookie)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            texto = r.read().decode()
            return r.status, (json.loads(texto) if texto else None)
    except urllib.error.HTTPError as e:
        texto = e.read().decode()
        try:
            return e.code, (json.loads(texto) if texto else None)
        except json.JSONDecodeError:
            return e.code, {'bruto': texto[:200]}


def multipart(url, campos, arquivo=None, cookie=None):
    """POST multipart/form-data montado a mao, como o navegador faz."""
    limite = f'----teste{uuid.uuid4().hex}'
    partes = []

    for chave, valor in campos.items():
        partes.append(
            f'--{limite}\r\nContent-Disposition: form-data; name="{chave}"\r\n\r\n{valor}\r\n'
            .encode()
        )

    if arquivo is not None:
        nome, conteudo, tipo = arquivo
        partes.append(
            (
                f'--{limite}\r\n'
                f'Content-Disposition: form-data; name="boletim"; filename="{nome}"\r\n'
                f'Content-Type: {tipo}\r\n\r\n'
            ).encode()
            + conteudo
            + b'\r\n'
        )

    partes.append(f'--{limite}--\r\n'.encode())
    corpo = b''.join(partes)

    req = urllib.request.Request(url, data=corpo, method='POST')
    req.add_header('Content-Type', f'multipart/form-data; boundary={limite}')
    if cookie:
        req.add_header('Cookie', cookie)

    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            texto = r.read().decode()
            return r.status, (json.loads(texto) if texto else None)
    except urllib.error.HTTPError as e:
        texto = e.read().decode()
        try:
            return e.code, (json.loads(texto) if texto else None)
        except json.JSONDecodeError:
            return e.code, {'bruto': texto[:200]}


def verificar(descricao, condicao, detalhe=''):
    global ok
    if condicao:
        ok += 1
        print(f'  OK    {descricao} {detalhe}')
    else:
        falhas.append(descricao)
        print(f'  FALHA {descricao} {detalhe}')


def entrar(email):
    dados = json.dumps({'email': email, 'senha': 'senhaSegura123'}).encode()
    req = urllib.request.Request(BASE + '/api/bff/login', data=dados, method='POST')
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.headers.get('Set-Cookie', '').split(';')[0]


# Um PDF minimo e VALIDO: o backend confere a assinatura, nao so o mimetype.
#
# Os BYTES NAO-ASCII no meio sao deliberados. Um PDF real tem streams
# comprimidos que nao formam UTF-8 valido, e um proxy que leia a resposta como
# texto os transforma em U+FFFD, corrompendo o arquivo em silencio. Com um PDF
# so de ASCII este teste passaria mesmo com o proxy quebrado — foi exatamente
# o que quase aconteceu aqui.
PDF_VALIDO = (
    b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
    b'2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n'
    b'3 0 obj<</Length 16/Filter/FlateDecode>>stream\n'
    + bytes(range(0x80, 0x90))
    + b'\nendstream endobj\n'
    + b'trailer<</Root 1 0 R>>\n%%EOF\n'
)

sufixo = str(int(time.time()))[-6:]
hoje = date.today()

print('\n== Sessoes ==')
prof = entrar('joao.ribeiro@ufx.edu.br')
verificar('login do professor', bool(prof))

print('\n== Catalogo publico (sem sessao) ==')
st, cursosPublicos = chamar('GET', API + '/cursos?ativo=true&limite=100')
verificar('GET /cursos e publico', st == 200, f'({st})')

st, profsPublicos = chamar('GET', API + '/professores/publicos?limite=100')
verificar('GET /professores/publicos e publico', st == 200, f'({st})')
verificar('projecao publica NAO expoe e-mail',
          bool(profsPublicos['dados']) and 'email' not in profsPublicos['dados'][0],
          f"({list(profsPublicos['dados'][0].keys()) if profsPublicos['dados'] else '-'})")

st, _ = chamar('GET', API + '/professores?limite=10')
verificar('GET /professores (completo) exige sessao', st in (401, 403), f'({st})')

st, _ = chamar('GET', API + '/inscricoes')
verificar('listagem de candidaturas exige sessao', st in (401, 403), f'({st})')

# --------------------------------------------------------------- cenario

print('\n== Cenario ==')
st, curso = chamar('POST', API + '/cursos', prof, {'nome': f'Curso Edital {sufixo}'})
verificar('cria curso', st == 201, f'({st})')

st, disc = chamar('POST', API + '/disciplinas', prof,
                  {'nome': f'Disciplina Edital {sufixo}', 'cursosIds': [curso['id']]})
verificar('cria disciplina do curso', st == 201, f'({st})')

professorId = profsPublicos['dados'][0]['usuarioId']

# ---------------------------------------------------------------- editais

print('\n== Edital ==')
st, invertido = chamar('POST', API + '/editais', prof,
                       {'ano': 2026, 'semestre': 2, 'link': 'https://ufx.edu.br/e.pdf',
                        'inicioInscricoes': str(hoje + timedelta(days=10)),
                        'fimInscricoes': str(hoje)})
verificar('periodo invertido e recusado', st == 409, f'({st})')

st, aberto = chamar('POST', API + '/editais', prof,
                    {'ano': 2026, 'semestre': 2,
                     'link': f'https://ufx.edu.br/edital-{sufixo}.pdf',
                     'inicioInscricoes': str(hoje - timedelta(days=1)),
                     'fimInscricoes': str(hoje + timedelta(days=10))})
verificar('cria edital que engloba hoje', st == 201, f'({st})')
verificar('`aceitandoInscricoes` vem derivado do servidor',
          aberto and aberto.get('aceitandoInscricoes') is True,
          f"({aberto.get('aceitandoInscricoes') if aberto else '-'})")
editalId = aberto['id']

st, vitrine = chamar('GET', API + '/editais/abertos')
verificar('vitrine publica responde sem sessao', st == 200, f'({st})')
verificar('o edital aberto aparece na vitrine',
          any(e['id'] == editalId for e in vitrine['dados']))
verificar('a vitrine publica NAO expoe `ativo`',
          bool(vitrine['dados']) and 'ativo' not in vitrine['dados'][0])

st, futuro = chamar('POST', API + '/editais', prof,
                    {'ano': 2027, 'semestre': 1,
                     'link': f'https://ufx.edu.br/edital-f{sufixo}.pdf',
                     'inicioInscricoes': str(hoje + timedelta(days=30)),
                     'fimInscricoes': str(hoje + timedelta(days=60))})
verificar('edital futuro nao aceita inscricao',
          st == 201 and futuro['aceitandoInscricoes'] is False)

st, vitrine2 = chamar('GET', API + '/editais/abertos')
verificar('edital futuro NAO aparece na vitrine',
          all(e['id'] != futuro['id'] for e in vitrine2['dados']))

# ------------------------------------------------------------- inscricao

print('\n== Inscricao publica (multipart, sem sessao) ==')
base = {
    'nomeCompleto': f'Maria Teste {sufixo}',
    'matricula': f'MT{sufixo}',
    'email': f'maria{sufixo}@ufx.edu.br',
    'cursoId': curso['id'],
    'disciplinaId': disc['id'],
    'professorId': professorId,
    'turno': 'MATUTINO',
    'n1': '8.5',
    'n2': '9.5',
}

st, conf = multipart(f'{API}/editais/{editalId}/inscricoes', base,
                     (f'boletim-{sufixo}.pdf', PDF_VALIDO, 'application/pdf'))
verificar('inscricao aceita SEM autenticacao', st == 201, f'({st}) {conf if st != 201 else ""}')
verificar('resposta traz o id da inscricao', bool(conf and conf.get('id')))
verificar('resposta diz se o e-mail saiu, em vez de supor',
          conf is not None and 'emailConfirmacaoEnviado' in conf,
          f"({conf.get('emailConfirmacaoEnviado') if conf else '-'})")

st, semBoletim = multipart(f'{API}/editais/{editalId}/inscricoes',
                           {**base, 'matricula': f'SB{sufixo}',
                            'email': f'sb{sufixo}@ufx.edu.br'}, None)
verificar('sem boletim e recusado', st == 400, f'({st})')

st, naoPdf = multipart(f'{API}/editais/{editalId}/inscricoes',
                       {**base, 'matricula': f'NP{sufixo}',
                        'email': f'np{sufixo}@ufx.edu.br'},
                       ('foto.png', b'\x89PNG\r\n\x1a\n' + b'0' * 50, 'image/png'))
verificar('arquivo que nao e PDF e recusado', st == 400, f'({st})')

st, duplicada = multipart(f'{API}/editais/{editalId}/inscricoes', base,
                          (f'b-{sufixo}.pdf', PDF_VALIDO, 'application/pdf'))
verificar('matricula repetida no mesmo edital e recusada', st == 409, f'({st})')

st, comMedia = multipart(f'{API}/editais/{editalId}/inscricoes',
                         {**base, 'matricula': f'CM{sufixo}',
                          'email': f'cm{sufixo}@ufx.edu.br', 'media': '10'},
                         (f'b2-{sufixo}.pdf', PDF_VALIDO, 'application/pdf'))
verificar('enviar `media` e recusado (ela e do banco)', st == 400, f'({st})')

# Nota em branco: deve ficar NULA, nunca zero.
st, semNota = multipart(f'{API}/editais/{editalId}/inscricoes',
                        {**base, 'matricula': f'SN{sufixo}',
                         'email': f'sn{sufixo}@ufx.edu.br', 'n1': '7', 'n2': ''},
                        (f'b3-{sufixo}.pdf', PDF_VALIDO, 'application/pdf'))
verificar('inscricao com nota em branco e aceita', st == 201, f'({st})')

st, futuroFechado = multipart(f'{API}/editais/{futuro["id"]}/inscricoes',
                              {**base, 'matricula': f'FF{sufixo}',
                               'email': f'ff{sufixo}@ufx.edu.br'},
                              (f'b4-{sufixo}.pdf', PDF_VALIDO, 'application/pdf'))
verificar('inscricao em edital nao iniciado e recusada', st == 409, f'({st})')

# ------------------------------------------------------- listagem da banca

print('\n== Listagem da banca ==')
st, lista = chamar('GET', f'{API}/inscricoes?editalId={editalId}&ordenarPor=media&direcao=desc',
                   prof)
verificar('listagem responde ao professor', st == 200, f'({st})')
verificar('traz as inscricoes do edital', lista['meta']['total'] >= 2,
          f"({lista['meta']['total']})")

primeira = lista['dados'][0]
verificar('media e calculada pelo servidor', primeira['media'] == 9.0,
          f"({primeira['media']})")
verificar('nota ausente fica NULA, nao zero',
          any(i['n2'] is None and i['media'] is None for i in lista['dados']))

# O criterio do atalho: notas ausentes nao podem ser o primeiro colocado.
comMediaLista = [i for i in lista['dados'] if i['media'] is not None]
verificar('quem tem media vem ANTES de quem nao tem (NULLS LAST)',
          [i['media'] is not None for i in lista['dados']]
          == sorted([i['media'] is not None for i in lista['dados']], reverse=True))

verificar('o metadado do boletim vem, mas nao os bytes',
          primeira['boletim'] is not None and 'conteudo' not in primeira['boletim'],
          f"({list(primeira['boletim'].keys()) if primeira['boletim'] else '-'})")

st, filtrada = chamar('GET', f'{API}/inscricoes?editalId={editalId}&turno=NOTURNO', prof)
verificar('filtro de turno recorta', filtrada['meta']['total'] == 0,
          f"({filtrada['meta']['total']})")

st, porCurso = chamar('GET', f'{API}/inscricoes?editalId={editalId}&cursoId={curso["id"]}', prof)
verificar('filtro de curso recorta', porCurso['meta']['total'] >= 2)

st, porDisciplina = chamar(
    'GET', f'{API}/inscricoes?editalId={editalId}&disciplinaId={disc["id"]}', prof)
verificar('filtro de disciplina recorta', st == 200 and porDisciplina['meta']['total'] >= 2,
          f"({porDisciplina['meta']['total'] if st == 200 else st})")
verificar('todas as linhas sao da disciplina pedida',
          all(i['disciplina']['id'] == disc['id'] for i in porDisciplina['dados']))

# Disciplina de OUTRO curso: o par incompativel devolve vazio, nao erro.
st, outraDisc = chamar('POST', API + '/disciplinas', prof,
                       {'nome': f'Fora do curso {sufixo}', 'cursosIds': [curso['id']]})
st, semResultado = chamar(
    'GET', f'{API}/inscricoes?editalId={editalId}&disciplinaId={outraDisc["id"]}', prof)
verificar('disciplina sem candidatura devolve lista vazia',
          st == 200 and semResultado['meta']['total'] == 0,
          f"({semResultado['meta']['total'] if st == 200 else st})")

st, combinado = chamar(
    'GET',
    f'{API}/inscricoes?editalId={editalId}&cursoId={curso["id"]}&disciplinaId={disc["id"]}',
    prof)
verificar('curso e disciplina combinam em vez de se anular',
          st == 200 and combinado['meta']['total'] >= 2,
          f"({combinado['meta']['total'] if st == 200 else st})")

termo = urllib.parse.quote(f'Maria Teste {sufixo}')
st, buscada = chamar('GET', f'{API}/inscricoes?editalId={editalId}&busca={termo}', prof)
verificar('busca por nome encontra', buscada['meta']['total'] >= 1)

st, topo = chamar('GET',
                  f'{API}/inscricoes?editalId={editalId}&ordenarPor=media&direcao=desc&limite=1',
                  prof)
verificar('consulta de 1 linha devolve a MAIOR media', topo['dados'][0]['media'] == 9.0,
          f"({topo['dados'][0]['media']})")

st, detalhe = chamar('GET', f'{API}/inscricoes/{primeira["id"]}', prof)
verificar('detalhe traz alunoCadastrado (quem ja tem conta)',
          st == 200 and 'alunoCadastrado' in detalhe)

# ------------------------------------------------------------ boletim PDF

print('\n== Download do boletim ==')
req = urllib.request.Request(f'{API}/inscricoes/{primeira["id"]}/boletim')
req.add_header('Cookie', prof)
with urllib.request.urlopen(req, timeout=60) as r:
    conteudo = r.read()
    disposicao = r.headers.get('Content-Disposition', '')
    tipo = r.headers.get('Content-Type', '')

verificar('o PDF volta integro pelo proxy', conteudo == PDF_VALIDO,
          f'({len(conteudo)} bytes, esperado {len(PDF_VALIDO)})')
verificar('vem como anexo, nunca inline', 'attachment' in disposicao, f'({disposicao[:40]})')
verificar('content-type e application/pdf', 'application/pdf' in tipo, f'({tipo})')

st, _ = chamar('GET', f'{API}/inscricoes/{primeira["id"]}/boletim')
verificar('boletim NAO e acessivel sem sessao', st in (401, 403), f'({st})')

# ------------------------------------------------------------- exclusao

print('\n== Exclusao logica ==')
st, _ = chamar('DELETE', f'{API}/editais/{futuro["id"]}', prof)
verificar('DELETE responde 204', st == 204, f'({st})')

st, excluido = chamar('GET', f'{API}/editais/{futuro["id"]}', prof)
verificar('o edital continua existindo, apenas inativo',
          st == 200 and excluido['ativo'] is False)

st, reativado = chamar('PATCH', f'{API}/editais/{futuro["id"]}', prof, {'ativo': True})
verificar('PATCH { ativo: true } reativa', st == 200 and reativado['ativo'] is True)

print(f'\n{"=" * 60}')
print(f'{ok} verificacoes OK, {len(falhas)} falhas')
for f in falhas:
    print(f'  - {f}')
print('=' * 60)
