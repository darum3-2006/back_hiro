import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

/** プロジェクト単位のデータ更新イベント種別（クライアントは該当データを再取得する） */
export type ProjectEventType =
  | 'tasks.changed'
  | 'comments.changed'
  | 'masters.changed'
  | 'members.changed'
  | 'views.changed';

/**
 * データ本体は載せない薄い「再取得シグナル」。
 * 本体は通常の REST 経由で取得させることで、権限チェック・テナントスコープをそのまま効かせる。
 */
export interface ProjectEvent {
  type: ProjectEventType;
  /** 関連タスク（タスク更新・コメント等）。特定できない場合は undefined */
  taskId?: string;
  /** 変更を行ったユーザー */
  originUserId: string;
  /**
   * 変更を行ったタブの ID（リクエストの X-Client-Id ヘッダ由来）。
   * 受信側は自タブ発のイベントだけを無視する（同一ユーザーの別タブには反映させる）
   */
  originClientId?: string;
}

/** 通知 SSE と同じく単一インスタンス前提のオンメモリ pub/sub。 */
@Injectable()
export class ProjectEventsService {
  private readonly streams = new Map<string, Subject<ProjectEvent>>();

  emit(projectId: string, event: ProjectEvent): void {
    this.streams.get(projectId)?.next(event);
  }

  stream(projectId: string): Observable<ProjectEvent> {
    let s = this.streams.get(projectId);
    if (!s) {
      s = new Subject<ProjectEvent>();
      this.streams.set(projectId, s);
    }
    return s.asObservable();
  }
}
