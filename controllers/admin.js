import TryCatch from "../middlewares/TryCatch.js";
import { Courses } from "../models/Courses.js";
import { Lecture } from "../models/Lecture.js";
import { rm } from "fs";
import { promisify } from "util";
import fs from "fs";
import { User } from "../models/User.js";

export const createCourse = TryCatch(async (req, res) => {
  const { title, description, category, createdBy, duration, price } = req.body;

  const image = req.file;

  await Courses.create({
    title,
    description,
    category,
    createdBy,
    image: image?.path,
    duration,
    price,
  });

  res.status(201).json({
    message: "Course Created Successfully",
  });
});

export const addLectures = TryCatch(async (req, res) => {
  const course = await Courses.findById(req.params.id);

  if (!course)
    return res.status(404).json({
      message: "No Course with this id",
    });

  const { title, description } = req.body;

  const file = req.file;

  const lecture = await Lecture.create({
    title,
    description,
    video: file?.path,
    course: course._id,
  });

  res.status(201).json({
    message: "Lecture Added",
    lecture,
  });
});

export const deleteLecture = TryCatch(async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);

  rm(lecture.video, () => {
    console.log("Video deleted");
  });

  await lecture.deleteOne();

  res.json({ message: "Lecture Deleted" });
});

// ... (keep other existing functions unchanged) ...

const unlinkAsync = promisify(fs.unlink);

export const deleteCourse = TryCatch(async (req, res) => {
  // Find the course
  const course = await Courses.findById(req.params.id);
  
  if (!course) {
    return res.status(404).json({
      message: "Course not found"
    });
  }

  try {
    // Find all lectures associated with the course
    const lectures = await Lecture.find({ course: course._id });

    // Delete all lecture videos from storage
    await Promise.all(
      lectures.map(async (lecture) => {
        if (lecture.video && fs.existsSync(lecture.video)) {
          await unlinkAsync(lecture.video);
          console.log(`Deleted lecture video: ${lecture.video}`);
        }
      })
    );

    // Delete course image if it exists
    if (course.image && fs.existsSync(course.image)) {
      await unlinkAsync(course.image);
      console.log(`Deleted course image: ${course.image}`);
    }

    // Delete all lectures from the database
    await Lecture.deleteMany({ course: course._id });
    console.log(`Deleted all lectures for course: ${course._id}`);

    // Delete the course itself
    await course.deleteOne();
    console.log(`Deleted course: ${course._id}`);

    // Remove course from all users' subscriptions
    await User.updateMany(
      { subscription: course._id },
      { $pull: { subscription: course._id } }
    );
    console.log(`Removed course from all user subscriptions`);

    res.status(200).json({
      success: true,
      message: "Course and all associated content deleted successfully"
    });
  } catch (error) {
    // If something fails, send error response
    console.error("Error deleting course:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete course",
      error: error.message
    });
  }
});

// ... (keep other existing functions unchanged) ...

export const getAllStats = TryCatch(async (req, res) => {
  const totalCoures = (await Courses.find()).length;
  const totalLectures = (await Lecture.find()).length;
  const totalUsers = (await User.find()).length;

  const stats = {
    totalCoures,
    totalLectures,
    totalUsers,
  };

  res.json({
    stats,
  });
});

export const getAllUser = TryCatch(async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } }).select(
    "-password"
  );

  res.json({ users });
});

export const updateRole = TryCatch(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user.role === "user") {
    user.role = "admin";
    await user.save();

    return res.status(200).json({
      message: "Role updated to admin",
    });
  }

  if (user.role === "admin") {
    user.role = "user";
    await user.save();

    return res.status(200).json({
      message: "Role updated",
    });
  }
});
