/**
 * src/components/project/MemberManagementModal.tsx
 * プロジェクトのメンバー管理モーダル（オーナーのみが開ける）。現在のメンバー一覧の
 * 表示・追加／削除・オーナー譲渡を行う。確認ダイアログを含む実処理はApp.tsx側の
 * ハンドラーに委譲し、このコンポーネントはPropsで受け取った内容を表示するだけ（規約①）。
 */
import type { Project, User } from '../../types/task';

interface ProjectMemberInfo {
  userId: string;
  role: string;
}

interface MemberManagementModalProps {
  isOpen: boolean;
  project?: Project;
  members: ProjectMemberInfo[];
  users: User[];
  onClose: () => void;
  onAddMember: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
  onTransferOwnership: (userId: string) => void;
}

export default function MemberManagementModal({
  isOpen,
  project,
  members,
  users,
  onClose,
  onAddMember,
  onRemoveMember,
  onTransferOwnership,
}: MemberManagementModalProps) {
  if (!isOpen || !project) return null;

  // まだ参加していない登録ユーザーだけを「追加」候補として抽出する
  const memberUserIds = new Set(members.map((m) => m.userId));
  const candidates = users.filter((u) => !memberUserIds.has(u.id));

  const getUser = (userId: string) => users.find((u) => u.id === userId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-card border border-border-card rounded-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">

        <div className="pb-2 border-b border-border-card/40">
          <h3 className="font-extrabold text-xs tracking-wider text-text-main">
            メンバー管理：{project.name}
          </h3>
        </div>

        <div>
          <label className="block text-[10px] font-black text-text-sub uppercase mb-1.5">
            現在のメンバー（{members.length}人）
          </label>
          <div className="space-y-1.5">
            {members.map((m) => {
              const user = getUser(m.userId);
              if (!user) return null;
              const isOwnerRow = m.role === 'owner';
              return (
                <div
                  key={m.userId}
                  className="flex items-center justify-between gap-2 h-11 px-3 bg-base border border-border-card rounded-xl"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-border-card flex items-center justify-center font-bold text-[9px] text-text-main flex-shrink-0 overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-6 h-6 object-cover" />
                      ) : (
                        user.name.slice(0, 2)
                      )}
                    </span>
                    <span className="text-[11px] font-bold text-text-main truncate">{user.name}</span>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                        isOwnerRow
                          ? 'bg-accent/10 border-accent/30 text-accent'
                          : 'bg-surface border-border-card text-text-sub'
                      }`}
                    >
                      {isOwnerRow ? 'オーナー' : 'メンバー'}
                    </span>
                  </div>

                  {/* オーナー行自体には操作ボタンを出さない（譲渡はtransfer_project_ownership()を
                      必ず経由させ、直接ロールを書き換えられないようにするRLS方針と一致させる） */}
                  {!isOwnerRow && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => onTransferOwnership(user.id)}
                        className="h-7 px-2 bg-surface hover:bg-accent/10 hover:text-accent border border-border-card/50 rounded-lg text-[9px] font-bold text-text-sub transition cursor-pointer"
                      >
                        オーナーにする
                      </button>
                      <button
                        onClick={() => onRemoveMember(user.id)}
                        className="h-7 px-2 bg-surface hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-border-card/50 rounded-lg text-[9px] font-bold text-text-sub transition cursor-pointer"
                      >
                        削除
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-text-sub uppercase mb-1.5">
            メンバーを追加
          </label>
          {candidates.length === 0 ? (
            <p className="text-[11px] text-text-sub font-medium">追加できる登録ユーザーがいません。</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {candidates.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onAddMember(user.id)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl border text-[11px] font-bold cursor-pointer transition bg-base border-border-card text-text-sub hover:text-accent hover:border-accent/40 hover:bg-accent/10"
                >
                  ＋ {user.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-border-card/30">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 bg-surface hover:bg-base text-text-sub font-bold text-xs rounded-xl cursor-pointer border border-border-card/50 transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
