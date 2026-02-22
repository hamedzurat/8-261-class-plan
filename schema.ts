export interface Schedule {
  day: string;
  start_time: string;
  end_time: string;
}

export interface SeatDetail {
  totalSeats: number;
  seatsTaken: number;
}

export interface Section {
  section_id: string;
  section_name: string;
  faculty_name: string;
  faculty_code: string;
  faculty_email: string;
  room_details: string;
  formal_code: string;
  schedule: Schedule[];
  credits: number;
  total_seats: number;
  seats_taken: number;
  course_code: string;
  department_code: string;
  seat_info: Record<string, SeatDetail>;
  stop_option_to_change_section: boolean;
  isMapped: boolean;
}

export interface Course {
  course_code: string;
  course_name: string;
  formal_code: string;
  credits: number;
  have_mapped_sections: boolean;
  mapped_section_ids: string[];
  sections: Section[];
}

export interface CourseData {
  courses: Course[];
  [key: string]: any; // To allow for other fields in data if any
}

export interface CourseDataResponse {
  status: string;
  data: CourseData;
}
