import { BehaviorSubject, Subject, filter, firstValueFrom, queueScheduler } from "rxjs";
import type { Evento } from "../domain/eventos";

export class Barramento {
  private readonly eventos = new Subject<Evento>();
  private readonly atividades = new BehaviorSubject(0);
  readonly eventos$ = this.eventos.asObservable();

  publicar(evento: Evento): void {
    const concluir = this.iniciarAtividade();
    // Todas as assinaturas recebem o evento antes de uma publicação reentrante.
    queueScheduler.schedule(() => {
      try {
        this.eventos.next(evento);
      } finally {
        concluir();
      }
    });
  }

  iniciarAtividade(): () => void {
    this.atividades.next(this.atividades.value + 1);
    return () => this.atividades.next(this.atividades.value - 1);
  }

  async aguardarOciosidade(): Promise<void> {
    await firstValueFrom(this.atividades.pipe(filter((quantidade) => quantidade === 0)));
  }

  encerrar(): void {
    this.eventos.complete();
    this.atividades.complete();
  }
}
