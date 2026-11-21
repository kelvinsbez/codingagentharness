import { randomUUID } from "node:crypto";
import { defer, map, Observable, of, tap, timer } from "rxjs";
import { Pedido } from "../domain/eventos";

export type ResultadoCobranca =
    | { readonly aprovado: true; readonly cobrancaId: string }
    | { readonly aprovado: false };

export type ResultadoReserva = "reservado" | "insuficiente";

export interface GatewayPagamento {
    cobrar(pedido: Pedido): Observable<ResultadoCobranca>;
    estornar(pedido: Pedido, cobrancaId: string): Observable<void>;
}

export interface ControleEstoque {
    reservar(pedido: Pedido): Observable<ResultadoReserva>;
}

export interface Transportadora {
    agendar(pedido: Pedido): Observable<string>;
}

export interface Mensageria {
    notificar(pedido: Pedido, rastreio: string): Observable<void>;
}

export interface Servicos {
    readonly pagamento: GatewayPagamento;
    readonly estoque: ControleEstoque;
    readonly transporte: Transportadora;
    readonly mensagens: Mensageria;
}

type Resposta<T> = { atrasoMs?: number } & ({ valor: T } | { erro: Error });
type Cenario<T, Argumentos extends unknown[] = [Pedido]> =
    (...argumentos: Argumentos) => Resposta<T>;

interface CenariosSimulados {
    estoqueInicial?: Readonly<Record<string, number>>;
    cobrar?: Cenario<ResultadoCobranca>;
    estornar?: Cenario<void, [Pedido, string]>;
    reservar?: Cenario<ResultadoReserva>;
    agendar?: Cenario<string>;
    notificar?: Cenario<void, [Pedido, string]>;
}

function simular<T, Argumentos extends unknown[]>(
    cenario: Cenario<T, Argumentos> | undefined,
    padrao: (...argumentos: Argumentos) => T,
): (...argumentos: Argumentos) => Observable<T> {
    return (...argumentos) => defer(() => {
        const resposta = cenario?.(...argumentos);
        const atraso = resposta?.atrasoMs ?? 0;

        return (atraso > 0 ? timer(atraso) : of(0)).pipe(map(() => {
            if (!resposta) {
                return padrao(...argumentos);
            }
            if ("erro" in resposta) {
                throw resposta.erro;
            }
            return resposta.valor;
        }));
    });
}

export function criarServicosSimulados(cenarios: CenariosSimulados = {}): Servicos {
    const estoque = new Map(Object.entries(cenarios.estoqueInicial ?? {}));
    const cobrancas = new Set<string>();
    const cobrar = simular(cenarios.cobrar, (): ResultadoCobranca => ({
        aprovado: true, cobrancaId: randomUUID(),
    }));
    const estornar = simular(cenarios.estornar, (_pedido, cobrancaId) => {
        if (!cobrancas.has(cobrancaId)) {
            throw new Error("Cobrança aprovada não encontrada: " + cobrancaId);
        }
    });

    return {
        pagamento: {
            cobrar: pedido => cobrar(pedido).pipe(tap(resultado => {
                if (resultado.aprovado) {
                    cobrancas.add(resultado.cobrancaId);
                }
            })),
            estornar: (pedido, cobrancaId) => estornar(pedido, cobrancaId).pipe(tap(() => {
                cobrancas.delete(cobrancaId);
            })),
        },
        estoque: {
            reservar: simular(cenarios.reservar, (pedido): ResultadoReserva => {
                const solicitados = new Map<string, number>();
                for (const { produtoId, quantidade } of pedido.itens) {
                    solicitados.set(produtoId, (solicitados.get(produtoId) ?? 0) + quantidade);
                }
                for (const [produtoId, quantidade] of solicitados) {
                    if ((estoque.get(produtoId) ?? 0) < quantidade) {
                        return "insuficiente";
                    }
                }
                for (const [produtoId, quantidade] of solicitados) {
                    estoque.set(produtoId, (estoque.get(produtoId) ?? 0) - quantidade);
                }
                return "reservado";
            }),
        },
        transporte: { agendar: simular(cenarios.agendar, () => randomUUID()) },
        mensagens: { notificar: simular(cenarios.notificar, () => undefined) },
    };
}
