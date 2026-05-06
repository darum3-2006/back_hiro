import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
  ) {}

  findByKey(key: string): Promise<Tenant | null> {
    return this.tenants.findOne({ where: { key } });
  }

  findById(id: string): Promise<Tenant | null> {
    return this.tenants.findOne({ where: { id } });
  }

  /** テナント作成（管理 CLI 用途）。UI 経由は想定しない。 */
  async create(input: { key: string; name: string }): Promise<Tenant> {
    const key = input.key.trim().toLowerCase();
    const existing = await this.tenants.findOne({ where: { key } });
    if (existing) {
      throw new ConflictException(`テナントキー「${key}」は既に使われています`);
    }
    const tenant = this.tenants.create({ key, name: input.name.trim() });
    return this.tenants.save(tenant);
  }
}
