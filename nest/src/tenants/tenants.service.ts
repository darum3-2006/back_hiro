import { Injectable } from '@nestjs/common';
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
}
