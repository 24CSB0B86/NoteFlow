'use strict';

const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const { query } = require('../config/db');
const { awardKarma, createNotification } = require('../services/karmaEngine');
const { generateTestFromContext } = require('../services/aiService');

// ── Multer ────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`File type not allowed: ${file.mimetype}. Only PDF and DOCX are accepted.`));
  },
});

// ── Helper: membership check ──────────────────────────────────────────────────
async function isMember(classroomId, userId) {
  const r = await query(
    `SELECT 1 FROM classroom_members WHERE classroom_id = $1 AND user_id = $2
     UNION SELECT 1 FROM classrooms WHERE id = $1 AND professor_id = $2`,
    [classroomId, userId]
  );
  return r.rows.length > 0;
}

// ── Helper: get signed URL ────────────────────────────────────────────────────
async function getSignedUrl(path, expiresIn = 3600) {
  const { data, error } = await supabaseAdmin.storage.from('resources').createSignedUrl(path, expiresIn);
  if (error) throw new Error(`Signed URL error: ${error.message}`);
  return data.signedUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exam/:classroomId/sections
// ─────────────────────────────────────────────────────────────────────────────
const getSections = async (req, res) => {
  try {
    const { classroomId } = req.params;
    if (!(await isMember(classroomId, req.user.id))) {
      return res.status(403).json({ error: 'Not a classroom member' });
    }

    // Ensure both midterm and endterm sections exist (auto-create if needed)
    for (const type of ['midterm', 'endterm']) {
      await query(
        `INSERT INTO exam_sections (classroom_id, exam_type, title, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (classroom_id, exam_type) DO NOTHING`,
        [classroomId, type, type === 'midterm' ? 'Midterm Exam' : 'Endterm Exam', req.user.id]
      );
    }

    const result = await query(
      `SELECT es.*,
              (SELECT COUNT(*) FROM exam_resources er WHERE er.exam_section_id = es.id AND er.status = 'approved') AS resource_count,
              (SELECT COUNT(*) FROM exam_resources er WHERE er.exam_section_id = es.id AND er.status = 'pending') AS pending_count,
              (SELECT COUNT(*) FROM revision_tests rt WHERE rt.exam_section_id = es.id AND rt.is_active = TRUE) AS test_count
       FROM exam_sections es
       WHERE es.classroom_id = $1
       ORDER BY es.exam_type ASC`,
      [classroomId]
    );

    console.log(`[Exam] ✅ getSections – ${result.rows.length} sections for classroom ${classroomId}`);
    res.json({ sections: result.rows });
  } catch (err) {
    console.error('[Exam] ❌ getSections error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exam/section/:sectionId/resources
// ─────────────────────────────────────────────────────────────────────────────
const getSectionResources = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { status, resource_type, search } = req.query;

    // Get classroom_id for membership check
    const secRes = await query(`SELECT classroom_id FROM exam_sections WHERE id = $1`, [sectionId]);
    if (secRes.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    const classroomId = secRes.rows[0].classroom_id;

    if (!(await isMember(classroomId, req.user.id))) {
      return res.status(403).json({ error: 'Not a classroom member' });
    }

    let where = `er.exam_section_id = $1`;
    const params = [sectionId];
    let idx = 2;

    // Students only see approved resources; professors see all
    if (req.user.role !== 'professor') {
      // Students see approved + their own pending
      where += ` AND (er.status = 'approved' OR er.uploader_id = $${idx++})`;
      params.push(req.user.id);
    } else if (status) {
      where += ` AND er.status = $${idx++}`;
      params.push(status);
    }

    if (resource_type) {
      where += ` AND er.resource_type = $${idx++}`;
      params.push(resource_type);
    }
    if (search) {
      where += ` AND (er.file_name ILIKE $${idx} OR er.description ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const result = await query(
      `SELECT er.*, u.full_name AS uploader_name, u.role AS uploader_role,
              rv.full_name AS reviewer_name
       FROM exam_resources er
       JOIN users u ON u.id = er.uploader_id
       LEFT JOIN users rv ON rv.id = er.reviewed_by
       WHERE ${where}
       ORDER BY er.created_at DESC`,
      params
    );

    console.log(`[Exam] ✅ getSectionResources – ${result.rows.length} resources for section ${sectionId}`);
    res.json({ resources: result.rows });
  } catch (err) {
    console.error('[Exam] ❌ getSectionResources error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exam/section/:sectionId/upload
// ─────────────────────────────────────────────────────────────────────────────
const uploadExamResource = [
  upload.single('file'),
  async (req, res) => {
    try {
      const { sectionId } = req.params;
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file provided' });

      const secRes = await query(
        `SELECT es.*, c.professor_id FROM exam_sections es JOIN classrooms c ON c.id = es.classroom_id WHERE es.id = $1`,
        [sectionId]
      );
      if (secRes.rows.length === 0) return res.status(404).json({ error: 'Exam section not found' });
      const section = secRes.rows[0];

      if (!(await isMember(section.classroom_id, req.user.id))) {
        return res.status(403).json({ error: 'Not a classroom member' });
      }

      const { resource_type, year, topic_coverage, description } = req.body;
      const isProfessor = req.user.role === 'professor';

      // Upload to Supabase
      const resourceId = uuidv4();
      const ext = file.mimetype.includes('pdf') ? 'pdf' : 'docx';
      const filePath = `exam/${section.classroom_id}/${sectionId}/${resourceId}.${ext}`;

      const fileData = new Uint8Array(file.buffer);
      const { error: uploadError } = await supabaseAdmin.storage
        .from('resources')
        .upload(filePath, fileData, { contentType: file.mimetype, upsert: false });
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      // Professor uploads are auto-approved; student uploads go to pending
      const status = isProfessor ? 'approved' : 'pending';
      const reviewedBy = isProfessor ? req.user.id : null;
      const reviewedAt = isProfessor ? new Date().toISOString() : null;

      const result = await query(
        `INSERT INTO exam_resources
           (id, exam_section_id, classroom_id, uploader_id, file_name, file_url,
            file_type, file_size, resource_type, year, topic_coverage, description,
            status, reviewed_by, reviewed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [resourceId, sectionId, section.classroom_id, req.user.id, file.originalname,
         filePath, file.mimetype, file.size,
         resource_type || 'other', year || null, topic_coverage || null, description || null,
         status, reviewedBy, reviewedAt]
      );

      // Award karma for approved uploads
      if (status === 'approved') {
        await awardKarma(req.user.id, 'upload', resourceId, `Uploaded exam resource "${file.originalname}"`).catch(() => {});
      }

      // Notify professor if student upload (pending approval)
      if (!isProfessor) {
        await createNotification(
          section.professor_id,
          'exam_resource_pending',
          '📋 New exam resource pending review',
          `${req.user.full_name} submitted "${file.originalname}" to ${section.exam_type} section`,
          `/classrooms/${section.classroom_id}/exam`
        ).catch(() => {});
      }

      console.log(`[Exam] ✅ uploadExamResource – resourceId: ${resourceId} status: ${status}`);
      res.status(201).json({ success: true, resource: result.rows[0] });
    } catch (err) {
      console.error('[Exam] ❌ uploadExamResource error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exam/resource/:resourceId/download
// ─────────────────────────────────────────────────────────────────────────────
const downloadExamResource = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const result = await query(
      `SELECT er.*, es.classroom_id AS section_classroom
       FROM exam_resources er JOIN exam_sections es ON es.id = er.exam_section_id
       WHERE er.id = $1`,
      [resourceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });

    const r = result.rows[0];
    // Students only download approved resources
    if (req.user.role !== 'professor' && r.status !== 'approved' && r.uploader_id !== req.user.id) {
      return res.status(403).json({ error: 'Resource not yet approved' });
    }

    const signedUrl = await getSignedUrl(r.file_url, 300);
    await query(`UPDATE exam_resources SET download_count = download_count + 1 WHERE id = $1`, [resourceId]);

    console.log(`[Exam] ✅ downloadExamResource – ${resourceId}`);
    res.json({ url: signedUrl, fileName: r.file_name });
  } catch (err) {
    console.error('[Exam] ❌ downloadExamResource error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exam/resource/:resourceId/approve  (Professor only)
// ─────────────────────────────────────────────────────────────────────────────
const approveExamResource = async (req, res) => {
  try {
    if (req.user.role !== 'professor') return res.status(403).json({ error: 'Professor access required' });

    const { resourceId } = req.params;
    const result = await query(
      `UPDATE exam_resources SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2 RETURNING *, (SELECT uploader_id FROM exam_resources WHERE id = $2) AS uid`,
      [req.user.id, resourceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });

    const r = result.rows[0];
    // Award 15 karma to student
    await awardKarma(r.uploader_id, 'upload', resourceId, `Exam resource "${r.file_name}" approved`).catch(() => {});
    await createNotification(
      r.uploader_id, 'exam_resource_approved',
      '✅ Exam resource approved!',
      `"${r.file_name}" is now visible to all students. +15 karma!`,
      `/classrooms/${r.classroom_id}/exam`
    ).catch(() => {});

    console.log(`[Exam] ✅ approveExamResource – ${resourceId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Exam] ❌ approveExamResource error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exam/resource/:resourceId/reject  (Professor only)
// ─────────────────────────────────────────────────────────────────────────────
const rejectExamResource = async (req, res) => {
  try {
    if (req.user.role !== 'professor') return res.status(403).json({ error: 'Professor access required' });

    const { resourceId } = req.params;
    const { reason } = req.body;
    const result = await query(
      `UPDATE exam_resources SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), reject_reason = $2
       WHERE id = $3 RETURNING *`,
      [req.user.id, reason || null, resourceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });

    const r = result.rows[0];
    await createNotification(
      r.uploader_id, 'exam_resource_rejected',
      '📝 Exam resource needs revision',
      `"${r.file_name}" was not approved. Reason: ${reason || 'No reason given'}`,
      `/classrooms/${r.classroom_id}/exam`
    ).catch(() => {});

    console.log(`[Exam] ✅ rejectExamResource – ${resourceId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Exam] ❌ rejectExamResource error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exam/section/:sectionId/tests
// ─────────────────────────────────────────────────────────────────────────────
const getTests = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const secRes = await query(`SELECT classroom_id FROM exam_sections WHERE id = $1`, [sectionId]);
    if (secRes.rows.length === 0) return res.status(404).json({ error: 'Section not found' });

    if (!(await isMember(secRes.rows[0].classroom_id, req.user.id))) {
      return res.status(403).json({ error: 'Not a classroom member' });
    }

    const result = await query(
      `SELECT rt.*,
              u.full_name AS creator_name,
              (SELECT COUNT(*) FROM test_questions WHERE test_id = rt.id) AS question_count,
              (SELECT COUNT(*) FROM test_attempts ta WHERE ta.test_id = rt.id AND ta.student_id = $2 AND ta.status = 'completed') AS my_attempts,
              (SELECT MAX(percentage) FROM test_attempts WHERE test_id = rt.id AND student_id = $2 AND status = 'completed') AS my_best_score
       FROM revision_tests rt
       JOIN users u ON u.id = rt.created_by
       WHERE rt.exam_section_id = $1 AND rt.is_active = TRUE
       ORDER BY rt.created_at DESC`,
      [sectionId, req.user.id]
    );

    console.log(`[Exam] ✅ getTests – ${result.rows.length} tests for section ${sectionId}`);
    res.json({ tests: result.rows });
  } catch (err) {
    console.error('[Exam] ❌ getTests error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exam/section/:sectionId/tests  (Professor only)
// ─────────────────────────────────────────────────────────────────────────────
const createTest = async (req, res) => {
  try {
    if (req.user.role !== 'professor') return res.status(403).json({ error: 'Professor access required' });

    const { sectionId } = req.params;
    const { title, description, duration_mins, topics_covered, questions } = req.body;

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'title and questions array are required' });
    }

    const secRes = await query(`SELECT classroom_id FROM exam_sections WHERE id = $1`, [sectionId]);
    if (secRes.rows.length === 0) return res.status(404).json({ error: 'Section not found' });

    const testResult = await query(
      `INSERT INTO revision_tests (exam_section_id, classroom_id, created_by, title, description, duration_mins, total_questions, topics_covered)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [sectionId, secRes.rows[0].classroom_id, req.user.id, title, description || null,
       duration_mins || 30, questions.length, topics_covered || []]
    );

    const testId = testResult.rows[0].id;

    // Insert questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await query(
        `INSERT INTO test_questions (test_id, question, options, correct_opt, explanation, order_num)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [testId, q.question, JSON.stringify(q.options), q.correct_opt, q.explanation || null, i]
      );
    }

    console.log(`[Exam] ✅ createTest – ${testId} with ${questions.length} questions`);
    res.status(201).json({ success: true, test: testResult.rows[0] });
  } catch (err) {
    console.error('[Exam] ❌ createTest error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exam/section/:sectionId/tests/generate  (Professor only)
// ─────────────────────────────────────────────────────────────────────────────
const generateTestWithAI = async (req, res) => {
  try {
    if (req.user.role !== 'professor') return res.status(403).json({ error: 'Professor access required' });

    const { sectionId } = req.params;
    const { title, duration_mins, prompt, resourceIds } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const secRes = await query(`SELECT classroom_id FROM exam_sections WHERE id = $1`, [sectionId]);
    if (secRes.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    const classroomId = secRes.rows[0].classroom_id;

    // In the future: Add PDF extraction here if a reliable library is available.
    // For now, AI relies purely on the academic topics specified in the instruction prompt to ensure zero errors.
    let contextText = "Generate the test based purely on the given instructions and general academic knowledge of the topic.";

    // Call the OpenAI Service
    const aiTest = await generateTestFromContext(prompt, contextText);

    if (!aiTest || !aiTest.questions || !Array.isArray(aiTest.questions)) {
      throw new Error('AI returned an invalid test format.');
    }

    // Insert into database
    const testResult = await query(
      `INSERT INTO revision_tests (exam_section_id, classroom_id, created_by, title, description, duration_mins, total_questions, topics_covered)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [sectionId, classroomId, req.user.id, title || aiTest.title || 'AI Generated Test', aiTest.description || null,
       duration_mins || aiTest.duration_mins || 30, aiTest.questions.length, aiTest.topics_covered || []]
    );

    const testId = testResult.rows[0].id;

    for (let i = 0; i < aiTest.questions.length; i++) {
      const q = aiTest.questions[i];
      await query(
        `INSERT INTO test_questions (test_id, question, options, correct_opt, explanation, order_num)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [testId, q.question, JSON.stringify(q.options), q.correct_opt, q.explanation || null, i]
      );
    }

    console.log(`[Exam] ✅ generateTestWithAI – section ${sectionId}, test ${testId} with ${aiTest.questions.length} questions`);
    res.status(201).json({ success: true, test: testResult.rows[0] });

  } catch (err) {
    console.error('[Exam] ❌ generateTestWithAI error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exam/test/:testId  (fetch test with questions for attempt)
// ─────────────────────────────────────────────────────────────────────────────
const getTest = async (req, res) => {
  try {
    const { testId } = req.params;

    const testRes = await query(
      `SELECT rt.*, es.classroom_id
       FROM revision_tests rt JOIN exam_sections es ON es.id = rt.exam_section_id
       WHERE rt.id = $1 AND rt.is_active = TRUE`,
      [testId]
    );
    if (testRes.rows.length === 0) return res.status(404).json({ error: 'Test not found' });
    const test = testRes.rows[0];

    if (!(await isMember(test.classroom_id, req.user.id))) {
      return res.status(403).json({ error: 'Not a classroom member' });
    }

    // Check attempts
    const attemptCount = await query(
      `SELECT COUNT(*) AS cnt FROM test_attempts WHERE test_id = $1 AND student_id = $2 AND status = 'completed'`,
      [testId, req.user.id]
    );
    const attempts = parseInt(attemptCount.rows[0].cnt);
    if (attempts >= test.max_attempts && req.user.role !== 'professor') {
      return res.status(400).json({ error: `Maximum ${test.max_attempts} attempts reached` });
    }

    // Fetch questions (shuffle order for anti-cheating)
    const questions = await query(
      `SELECT id, question, options, order_num FROM test_questions WHERE test_id = $1 ORDER BY RANDOM()`,
      [testId]
    );

    // Don't expose correct_opt or explanation until test is submitted
    res.json({
      test: { ...test, attempts_used: attempts },
      questions: questions.rows,
    });
  } catch (err) {
    console.error('[Exam] ❌ getTest error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exam/test/:testId/submit
// ─────────────────────────────────────────────────────────────────────────────
const submitTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const { answers, time_taken_sec } = req.body; // answers: { questionId: selectedOptionId }

    const testRes = await query(
      `SELECT rt.*, es.classroom_id FROM revision_tests rt
       JOIN exam_sections es ON es.id = rt.exam_section_id
       WHERE rt.id = $1`,
      [testId]
    );
    if (testRes.rows.length === 0) return res.status(404).json({ error: 'Test not found' });
    const test = testRes.rows[0];

    // Check attempt limit
    const attemptCount = await query(
      `SELECT COUNT(*) AS cnt FROM test_attempts WHERE test_id = $1 AND student_id = $2 AND status = 'completed'`,
      [testId, req.user.id]
    );
    if (parseInt(attemptCount.rows[0].cnt) >= test.max_attempts && req.user.role !== 'professor') {
      return res.status(400).json({ error: 'Maximum attempts reached' });
    }

    // Fetch all questions with answers
    const questionsRes = await query(
      `SELECT id, correct_opt, explanation, question, options FROM test_questions WHERE test_id = $1`,
      [testId]
    );
    const questions = questionsRes.rows;
    const total = questions.length;

    let score = 0;
    const feedback = [];
    for (const q of questions) {
      const studentAns = answers?.[q.id];
      const isCorrect = studentAns === q.correct_opt;
      if (isCorrect) score++;
      feedback.push({
        questionId: q.id,
        question: q.question,
        options: q.options,
        studentAnswer: studentAns,
        correctAnswer: q.correct_opt,
        isCorrect,
        explanation: q.explanation,
      });
    }

    const percentage = total > 0 ? parseFloat(((score / total) * 100).toFixed(2)) : 0;

    // Save attempt
    const attemptResult = await query(
      `INSERT INTO test_attempts (test_id, student_id, answers, score, total_possible, percentage, time_taken_sec, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW()) RETURNING *`,
      [testId, req.user.id, JSON.stringify(answers || {}), score, total, percentage, time_taken_sec || null]
    );

    // Award karma based on score
    let karmaPoints = 5;
    if (percentage >= 90) karmaPoints = 20;
    else if (percentage >= 75) karmaPoints = 15;
    else if (percentage >= 60) karmaPoints = 10;

    await awardKarma(req.user.id, 'upload', testId,
      `Completed revision test "${test.title}" with ${percentage}% score`).catch(() => {});

    console.log(`[Exam] ✅ submitTest – ${testId} score: ${score}/${total} (${percentage}%) karma: ${karmaPoints}`);
    res.json({
      success: true,
      score,
      total,
      percentage,
      karmaAwarded: karmaPoints,
      feedback,
      attempt: attemptResult.rows[0],
    });
  } catch (err) {
    console.error('[Exam] ❌ submitTest error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exam/test/:testId/leaderboard
// ─────────────────────────────────────────────────────────────────────────────
const getTestLeaderboard = async (req, res) => {
  try {
    const { testId } = req.params;
    const result = await query(
      `SELECT u.full_name, u.id AS user_id,
              MAX(ta.percentage) AS best_score,
              COUNT(*) AS attempts,
              MIN(ta.time_taken_sec) AS best_time
       FROM test_attempts ta JOIN users u ON u.id = ta.student_id
       WHERE ta.test_id = $1 AND ta.status = 'completed'
       GROUP BY u.id, u.full_name
       ORDER BY best_score DESC, best_time ASC NULLS LAST
       LIMIT 20`,
      [testId]
    );
    res.json({ leaderboard: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getSections,
  getSectionResources,
  uploadExamResource,
  downloadExamResource,
  approveExamResource,
  rejectExamResource,
  getTests,
  createTest,
  generateTestWithAI,
  getTest,
  submitTest,
  getTestLeaderboard,
};
