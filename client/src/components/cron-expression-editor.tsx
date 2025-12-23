import { useState, useEffect, useMemo } from "react";
import { Clock, Calendar, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import cronstrue from "cronstrue";

interface CronExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const presets = [
  { label: "Every minute", cron: "* * * * *" },
  { label: "Every 5 minutes", cron: "*/5 * * * *" },
  { label: "Every 15 minutes", cron: "*/15 * * * *" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every day at midnight", cron: "0 0 * * *" },
  { label: "Every day at 9 AM", cron: "0 9 * * *" },
  { label: "Every Monday at 9 AM", cron: "0 9 * * 1" },
  { label: "Every weekday at 9 AM", cron: "0 9 * * 1-5" },
  { label: "First of every month", cron: "0 0 1 * *" },
];

const minuteOptions = [
  { value: "*", label: "Every minute" },
  { value: "0", label: "At minute 0" },
  { value: "15", label: "At minute 15" },
  { value: "30", label: "At minute 30" },
  { value: "45", label: "At minute 45" },
  { value: "*/5", label: "Every 5 minutes" },
  { value: "*/10", label: "Every 10 minutes" },
  { value: "*/15", label: "Every 15 minutes" },
  { value: "*/30", label: "Every 30 minutes" },
];

const hourOptions = [
  { value: "*", label: "Every hour" },
  { value: "0", label: "Midnight (0)" },
  { value: "6", label: "6 AM" },
  { value: "9", label: "9 AM" },
  { value: "12", label: "Noon (12)" },
  { value: "15", label: "3 PM" },
  { value: "18", label: "6 PM" },
  { value: "21", label: "9 PM" },
  { value: "*/2", label: "Every 2 hours" },
  { value: "*/4", label: "Every 4 hours" },
  { value: "*/6", label: "Every 6 hours" },
  { value: "*/12", label: "Every 12 hours" },
];

const dayOfMonthOptions = [
  { value: "*", label: "Every day" },
  { value: "1", label: "1st" },
  { value: "15", label: "15th" },
  { value: "L", label: "Last day" },
];

const monthOptions = [
  { value: "*", label: "Every month" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const dayOfWeekOptions = [
  { value: "*", label: "Every day" },
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "1-5", label: "Weekdays (Mon-Fri)" },
  { value: "0,6", label: "Weekends (Sat-Sun)" },
];

function parseCronParts(cron: string): { minute: string; hour: string; dayOfMonth: string; month: string; dayOfWeek: string } {
  const parts = cron.trim().split(/\s+/);
  return {
    minute: parts[0] || "*",
    hour: parts[1] || "*",
    dayOfMonth: parts[2] || "*",
    month: parts[3] || "*",
    dayOfWeek: parts[4] || "*",
  };
}

function getNextRuns(cron: string, count: number = 5): Date[] {
  try {
    const parts = parseCronParts(cron);
    const now = new Date();
    const dates: Date[] = [];
    let current = new Date(now);
    
    for (let i = 0; i < 1000 && dates.length < count; i++) {
      current = new Date(current.getTime() + 60000);
      
      const minute = current.getMinutes();
      const hour = current.getHours();
      const dayOfMonth = current.getDate();
      const month = current.getMonth() + 1;
      const dayOfWeek = current.getDay();
      
      if (matchesCronPart(parts.minute, minute) &&
          matchesCronPart(parts.hour, hour) &&
          matchesCronPart(parts.dayOfMonth, dayOfMonth) &&
          matchesCronPart(parts.month, month) &&
          matchesCronPart(parts.dayOfWeek, dayOfWeek)) {
        dates.push(new Date(current));
      }
    }
    
    return dates;
  } catch {
    return [];
  }
}

function matchesCronPart(pattern: string, value: number): boolean {
  if (pattern === "*") return true;
  if (pattern === "L") return true;
  
  if (pattern.includes("/")) {
    const [, step] = pattern.split("/");
    return value % parseInt(step, 10) === 0;
  }
  
  if (pattern.includes("-")) {
    const [start, end] = pattern.split("-").map(Number);
    return value >= start && value <= end;
  }
  
  if (pattern.includes(",")) {
    return pattern.split(",").map(Number).includes(value);
  }
  
  return parseInt(pattern, 10) === value;
}

export function CronExpressionEditor({ value, onChange, error }: CronExpressionEditorProps) {
  const [mode, setMode] = useState<"visual" | "raw">("visual");
  const parts = useMemo(() => parseCronParts(value), [value]);

  const handlePartChange = (part: keyof typeof parts, newValue: string) => {
    const newParts = { ...parts, [part]: newValue };
    const newCron = `${newParts.minute} ${newParts.hour} ${newParts.dayOfMonth} ${newParts.month} ${newParts.dayOfWeek}`;
    onChange(newCron);
  };

  let description = "";
  let isValid = true;
  try {
    description = cronstrue.toString(value);
  } catch {
    description = "Invalid cron expression";
    isValid = false;
  }

  const nextRuns = useMemo(() => getNextRuns(value), [value]);

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as "visual" | "raw")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="visual" data-testid="tab-visual">Visual Builder</TabsTrigger>
          <TabsTrigger value="raw" data-testid="tab-raw">Raw Expression</TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Minute
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>0-59, * for every minute</TooltipContent>
                </Tooltip>
              </Label>
              <Select value={parts.minute} onValueChange={(v) => handlePartChange("minute", v)}>
                <SelectTrigger data-testid="select-minute">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {minuteOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Hour
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>0-23, * for every hour</TooltipContent>
                </Tooltip>
              </Label>
              <Select value={parts.hour} onValueChange={(v) => handlePartChange("hour", v)}>
                <SelectTrigger data-testid="select-hour">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hourOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Day
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>1-31, * for every day</TooltipContent>
                </Tooltip>
              </Label>
              <Select value={parts.dayOfMonth} onValueChange={(v) => handlePartChange("dayOfMonth", v)}>
                <SelectTrigger data-testid="select-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayOfMonthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Month
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>1-12, * for every month</TooltipContent>
                </Tooltip>
              </Label>
              <Select value={parts.month} onValueChange={(v) => handlePartChange("month", v)}>
                <SelectTrigger data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Weekday
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>0-6 (Sun-Sat), * for any day</TooltipContent>
                </Tooltip>
              </Label>
              <Select value={parts.dayOfWeek} onValueChange={(v) => handlePartChange("dayOfWeek", v)}>
                <SelectTrigger data-testid="select-weekday">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayOfWeekOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Badge
                  key={preset.cron}
                  variant={value === preset.cron ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => onChange(preset.cron)}
                  data-testid={`preset-${preset.cron.replace(/\s/g, "-")}`}
                >
                  {preset.label}
                </Badge>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="raw" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="cron-raw" className="text-sm font-medium">
              Cron Expression
            </Label>
            <Input
              id="cron-raw"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="* * * * *"
              className={`font-mono ${error || !isValid ? "border-destructive" : ""}`}
              data-testid="input-cron-raw"
            />
            <p className="text-xs text-muted-foreground">
              Format: minute hour day-of-month month day-of-week
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="p-4 bg-muted rounded-md space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className={`text-sm font-medium ${!isValid ? "text-destructive" : ""}`}>
            {description}
          </span>
        </div>

        {isValid && nextRuns.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Next 5 runs:
            </p>
            <div className="grid gap-1">
              {nextRuns.map((date, i) => (
                <span key={i} className="text-xs text-muted-foreground font-mono">
                  {date.toLocaleString()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
