import { map } from "rxjs";
import { Barramento } from "../infra/barramento";
import { Processamento, tentar } from "../infra/processamento";
import { Mensageria } from "../infra/servicos";

export function iniciarNotificacao(
    barramento: Barramento,
    processamento: Processamento,
    mensagens: Mensageria,
) {
    return processamento.consumir(["EnvioAgendado"], 5, ({ pedido, rastreio }) =>
        tentar(() => mensagens.notificar(pedido, rastreio)).pipe(
            map(() => barramento.emitir({ tipo: "NotificacaoEnviada", pedido })),
        ),
    );
}
