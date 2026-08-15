"use client";

import * as React from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Calendar } from "./calendar";
import { Button } from "./button";
import { Input } from "./input";

function DateRangePicker() {
  const [range, setRange] = React.useState<DateRange | undefined>(undefined);

  const formatDate = (date: Date | undefined) => {
    return date ? format(date, "MM/dd/yyyy") : "";
  };

  const clearRange = () => {
    setRange(undefined);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex space-x-2">
        <Input
          type="text"
          readOnly
          placeholder="Start date"
          value={formatDate(range?.from)}
          className="w-40"
          aria-label="Start date"
        />
        <Input
          type="text"
          readOnly
          placeholder="End date"
          value={formatDate(range?.to)}
          className="w-40"
          aria-label="End date"
        />
        <Button variant="outline" size="sm" onClick={clearRange}>
          Clear
        </Button>
      </div>
      <Calendar
        mode="range"
        selected={range}
        onSelect={(selectedRange) => {
          setRange(selectedRange);
        }}
      />
    </div>
  );
}

export { DateRangePicker };
