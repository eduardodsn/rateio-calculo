# Rateio Fácil

Preciso fazer uma página web simples, de apenas uma página: Cálculo Rateio Qe 40

Deve ter uma forma de preencher todas essas informações da imagem anexada.

Deve ser possível adicionar linhas

Deve ser possível editar textos de colunas e linhas

Deve ter uma parte de legenda dos relógios com essas informações:
sem rotulo -> 302
invertido sem rótulo -> 601 
loja -> 01


as regras são simples:
Deve ter um campo para informar valor da conta
Deve ter um campo para informar taxa de condominio (padrão R$ 30,00)
Deve ter um campo para informar Taxa fixa
Deve ter um campo para informar quantas unidades pagam


Com base nas informações acima, deve calcular:
- Taxa individual = taxa fixa * 2 / quantidade de unidades que pagam
- Conta sem taxa fixa = valor da conta  -  (taxa individual * quantidade de unidades que pagam)

1- Coluna medido = leitura atual - leitura anterior
2- valor da água = ((medido * conta sem taxa fixa) / total medido de todas as unidades) + taxa individual
3- Taxa de condominio = valor informado de taxa de condominio
4- total a pagar = valor da água + taxa de condomínio

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://rateio-calculo.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1f2ab584-58b3-4df5-b54c-dcc237079710).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
