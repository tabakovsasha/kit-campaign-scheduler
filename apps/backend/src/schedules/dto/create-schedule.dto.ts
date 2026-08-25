import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const TIME_24H_REGEX = /^([01]\d|2[0-3]):?([0-5]\d)$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const normalizeTime24 = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  const match = trimmed.match(TIME_24H_REGEX);
  if (!match) {
    return trimmed;
  }

  return `${match[1]}:${match[2]}`;
};

class TimeIntervalDto {
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @IsString()
  @Transform(normalizeTime24)
  @Matches(TIME_24H_REGEX, { message: 'startTime must be in 24h format HH:mm' })
  startTime!: string;

  @IsString()
  @Transform(normalizeTime24)
  @Matches(TIME_24H_REGEX, { message: 'endTime must be in 24h format HH:mm' })
  endTime!: string;

  @IsOptional()
  @IsString()
  label?: string;
}

@ValidatorConstraint({ name: 'isExceptionDateRangeValid', async: false })
class ExceptionDateRangeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const dto = args.object as ScheduleExceptionDto;

    if (!dto.startDate || !dto.endDate) {
      return false;
    }

    return dto.endDate >= dto.startDate;
  }

  defaultMessage() {
    return 'endDate must be greater than or equal to startDate';
  }
}

class ScheduleExceptionDto {
  @IsString()
  @Matches(DATE_ONLY_REGEX)
  startDate!: string;

  @IsString()
  @Matches(DATE_ONLY_REGEX)
  @Validate(ExceptionDateRangeConstraint)
  endDate!: string;

  @IsIn(['day_off', 'custom_working_hours'])
  type!: 'day_off' | 'custom_working_hours';

  @ValidateIf((o: ScheduleExceptionDto) => o.type === 'custom_working_hours')
  @IsString()
  @Transform(normalizeTime24)
  @Matches(TIME_24H_REGEX, { message: 'customStartTime must be in 24h format HH:mm' })
  customStartTime?: string;

  @ValidateIf((o: ScheduleExceptionDto) => o.type === 'custom_working_hours')
  @IsString()
  @Transform(normalizeTime24)
  @Matches(TIME_24H_REGEX, { message: 'customEndTime must be in 24h format HH:mm' })
  customEndTime?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  isRecurringYearly?: boolean;
}

export class CreateScheduleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  campaignId!: number;

  @IsString()
  @IsNotEmpty()
  campaignTitle!: string;

  @IsOptional()
  @IsString()
  campaignTimezone?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY_REGEX)
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY_REGEX)
  endDate?: string;

  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays!: number[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeIntervalDto)
  workIntervals!: TimeIntervalDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeIntervalDto)
  breakIntervals?: TimeIntervalDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleExceptionDto)
  exceptions?: ScheduleExceptionDto[];

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ToggleScheduleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateScheduleDto extends CreateScheduleDto {}
