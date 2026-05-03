import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateTimeEntryDto {
  @ApiProperty({ example: 'uuid-of-project' })
  @IsString()
  projectId: string;

  @ApiProperty({ example: 'uuid-of-task' })
  @IsString()
  taskId: string;

  @ApiProperty({ example: '2026-04-23' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '2026-04-23T09:00:00.000Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2026-04-23T11:30:00.000Z' })
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional({ example: 'DEVELOPMENT', default: 'DEVELOPMENT' })
  @IsString()
  @IsOptional()
  workType?: string;

  @ApiPropertyOptional({ example: 'Implemented JWT authentication module' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ['MANUAL', 'TIMER', 'GIT', 'CLICKUP', 'SUGGESTED'], default: 'MANUAL' })
  @IsIn(['MANUAL', 'TIMER', 'GIT', 'CLICKUP', 'SUGGESTED'])
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ example: 'abc123def456' })
  @IsString()
  @IsOptional()
  relatedCommitHash?: string;

  @ApiPropertyOptional({ example: 'clickup-task-id' })
  @IsString()
  @IsOptional()
  relatedClickUpTaskId?: string;
}
