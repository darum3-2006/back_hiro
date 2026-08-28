import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findByTenantAndEmail(tenantId: string, email: string): Promise<User | null> {
    return this.users.findOne({ where: { tenantId, email } });
  }

  findByTenantAndGoogleSub(tenantId: string, googleSub: string): Promise<User | null> {
    return this.users.findOne({ where: { tenantId, googleSub } });
  }

  /** 既存ユーザに Google の sub を紐づける（初回 SSO ログイン時の連携）。 */
  async linkGoogleSub(userId: string, googleSub: string): Promise<void> {
    await this.users.update({ id: userId }, { googleSub });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  /** 公開APIキー認証用：ハッシュからユーザーを引く。 */
  findByApiKeyHash(apiKeyHash: string): Promise<User | null> {
    return this.users.findOne({ where: { apiKeyHash } });
  }

  /** APIキーを発行/再生成する（ハッシュとプレフィックスを保存、発行日時を更新）。 */
  async setApiKey(userId: string, hash: string, prefix: string): Promise<void> {
    await this.users.update(
      { id: userId },
      { apiKeyHash: hash, apiKeyPrefix: prefix, apiKeyCreatedAt: new Date() },
    );
  }

  /** APIキーを失効させる。 */
  async clearApiKey(userId: string): Promise<void> {
    await this.users.update(
      { id: userId },
      { apiKeyHash: null, apiKeyPrefix: null, apiKeyCreatedAt: null },
    );
  }

  listByTenant(tenantId: string): Promise<User[]> {
    return this.users.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(tenantId: string, dto: CreateUserDto): Promise<User> {
    const email = dto.email.trim().toLowerCase();
    // UNIQUE 制約は論理削除済みの行にも効くため、削除済みも含めて衝突を先回りで検出する
    const existing = await this.users.findOne({ where: { tenantId, email }, withDeleted: true });
    if (existing) {
      throw new ConflictException(
        existing.deletedAt
          ? 'このメールアドレスは削除済みユーザーが使用しています'
          : 'このメールアドレスはこのテナントで既に使われています',
      );
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.users.create({
      tenantId,
      email,
      name: dto.name.trim(),
      passwordHash,
      role: dto.role,
    });
    return this.users.save(user);
  }

  async update(
    tenantId: string,
    actingUserId: string,
    targetId: string,
    dto: UpdateUserDto,
  ): Promise<User> {
    const user = await this.findInTenant(tenantId, targetId);

    // 自分自身を降格させない
    if (dto.role !== undefined && actingUserId === targetId && dto.role !== user.role) {
      throw new BadRequestException('自分自身のロールを変更することはできません');
    }
    // 最後の admin を降格させない
    if (dto.role === 'member' && user.role === 'admin') {
      const adminCount = await this.users.count({ where: { tenantId, role: 'admin' } });
      if (adminCount <= 1) {
        throw new BadRequestException('最後の管理者を降格することはできません');
      }
    }

    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.password !== undefined) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    return this.users.save(user);
  }

  /**
   * パスワードを上書きする（本人による変更用）。
   * 呼び出し側で現在パスワードの検証を済ませている前提。
   */
  async setPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('ユーザーが見つかりません');
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.users.save(user);
  }

  /**
   * ユーザーを論理削除する（deleted_at をセット。設計は docs/USER_SOFT_DELETE.md）。
   * 以降は一覧・認証系の検索すべてから自動除外される。復元は運用（DB で
   * deleted_at を NULL に戻す）で行い、周辺データ（閲覧権限・メンバー紐づき等）は
   * 復元でそのまま戻せるよう削除時には触らない。
   */
  async remove(tenantId: string, actingUserId: string, targetId: string): Promise<void> {
    const user = await this.findInTenant(tenantId, targetId);
    // 自己削除禁止
    if (actingUserId === targetId) {
      throw new BadRequestException('自分自身を削除することはできません');
    }
    // 最後の admin を消させない
    if (user.role === 'admin') {
      const adminCount = await this.users.count({ where: { tenantId, role: 'admin' } });
      if (adminCount <= 1) {
        throw new BadRequestException('最後の管理者を削除することはできません');
      }
    }
    await this.users.softRemove(user);
  }

  private async findInTenant(tenantId: string, id: string): Promise<User> {
    const user = await this.users.findOne({ where: { tenantId, id } });
    if (!user) throw new NotFoundException('ユーザーが見つかりません');
    return user;
  }
}
