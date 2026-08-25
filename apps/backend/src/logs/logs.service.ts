import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  async bySchedule(userId: string, scheduleId: string, limit = 100) {
    const rows = await this.prisma.scheduleActionLog.findMany({
      where: {
        userId,
        scheduleId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.min(Math.max(limit, 1), 500),
    });

    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      action: row.action,
      status: row.status,
      campaignId: row.campaignId.toString(),
      campaignTitle: row.campaignTitle,
      httpStatus: row.httpStatus,
      requestId: row.requestId,
      errorMessage: row.errorMessage,
      responsePayload: row.responsePayload,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
