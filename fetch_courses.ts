const SECTION_FILE = "section.json";
const MY_FILE = "my.json";

const TARGET_CODES = [
  "1316-1-1",
  "1317-1-1",
  "1323-1-1",
  "1324-1-1",
  "1325-1-1",
  "1326-1-1",
];

async function analyzeCourses() {
  console.log(`Reading ${SECTION_FILE}...`);

  try {
    const file = Bun.file(SECTION_FILE);

    if (!(await file.exists())) {
      console.error(
        `Error: ${SECTION_FILE} not found. Please provide the file.`,
      );
      return;
    }

    const data = await file.json();

    console.log("Filtering courses...");
    if (data && data.data && Array.isArray(data.data.courses)) {
      const filteredCourses = data.data.courses.filter((course: any) =>
        TARGET_CODES.includes(course.course_code),
      );

      const result = {
        ...data,
        data: {
          ...data.data,
          courses: filteredCourses,
        },
      };

      await Bun.write(MY_FILE, JSON.stringify(result, null, 2));
      console.log(`Success! Filtered data saved to: ${MY_FILE}`);
      console.log(`Total courses found: ${filteredCourses.length}`);
    } else {
      console.error("Error: Unexpected JSON structure in section.json.");
    }
  } catch (error) {
    console.error("An error occurred during analysis:", error);
  }
}

analyzeCourses();
