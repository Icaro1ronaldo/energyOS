import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./DateRangePicker.css";

interface Props {
  start: Date;
  end: Date;
  onChange: (start: Date, end: Date) => void;
}

export default function DateRangePicker({ start, end, onChange }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ color: "#94a3b8", fontSize: 13 }}>From</span>
      <DatePicker
        selected={start}
        onChange={(date: Date | null) => date && onChange(date, end)}
        selectsStart
        startDate={start}
        endDate={end}
        maxDate={end}
        dateFormat="dd MMM yyyy"
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        calendarClassName="eos-calendar"
        className="eos-datepicker-input"
      />
      <span style={{ color: "#94a3b8", fontSize: 13 }}>To</span>
      <DatePicker
        selected={end}
        onChange={(date: Date | null) => date && onChange(start, date)}
        selectsEnd
        startDate={start}
        endDate={end}
        minDate={start}
        maxDate={new Date()}
        dateFormat="dd MMM yyyy"
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        calendarClassName="eos-calendar"
        className="eos-datepicker-input"
      />
    </div>
  );
}
