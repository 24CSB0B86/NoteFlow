import pool from '../config/db.js'

export const SyllabusModel = {
  /**
   * Get or create the syllabus for a classroom
   */
  async getOrCreate(classroomId, userId) {
    let { rows } = await pool.query(
      'SELECT * FROM syllabus WHERE classroom_id = $1',
      [classroomId]
    )
    if (rows.length > 0) return rows[0]
    const insert = await pool.query(
      `INSERT INTO syllabus (classroom_id, created_by)
       VALUES ($1, $2) RETURNING *`,
      [classroomId, userId]
    )
    return insert.rows[0]
  },

  /**
   * Get the full syllabus tree using a recursive CTE.
   * Returns nodes with resource_count for gap analysis.
   */
  async getTree(classroomId) {
    // First ensure syllabus exists
    const { rows: syl } = await pool.query(
      'SELECT id FROM syllabus WHERE classroom_id = $1',
      [classroomId]
    )
    if (syl.length === 0) return null

    const syllabusId = syl[0].id

    const { rows } = await pool.query(
      `WITH RECURSIVE tree AS (
         -- Base: root nodes (no parent)
         SELECT
           sn.id, sn.syllabus_id, sn.parent_id, sn.node_type,
           sn.title, sn.order_index, sn.has_resources,
           sn.created_at, sn.updated_at,
           0 AS depth,
           ARRAY[sn.order_index] AS sort_path
         FROM syllabus_nodes sn
         WHERE sn.syllabus_id = $1 AND sn.parent_id IS NULL

         UNION ALL

         -- Recursive: children
         SELECT
           sn.id, sn.syllabus_id, sn.parent_id, sn.node_type,
           sn.title, sn.order_index, sn.has_resources,
           sn.created_at, sn.updated_at,
           tree.depth + 1,
           tree.sort_path || sn.order_index
         FROM syllabus_nodes sn
         JOIN tree ON tree.id = sn.parent_id
       )
       SELECT
         t.*,
         COUNT(r.id)::int AS resource_count
       FROM tree t
       LEFT JOIN resources r ON r.syllabus_node_id = t.id
       GROUP BY t.id, t.syllabus_id, t.parent_id, t.node_type,
                t.title, t.order_index, t.has_resources,
                t.created_at, t.updated_at, t.depth, t.sort_path
       ORDER BY t.sort_path`,
      [syllabusId]
    )
    return { syllabusId, nodes: rows }
  },

  async addNode({ syllabusId, parentId, nodeType, title, orderIndex }) {
    // Auto-compute order_index if not provided
    if (orderIndex === undefined || orderIndex === null) {
      const { rows } = await pool.query(
        `SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx
         FROM syllabus_nodes
         WHERE syllabus_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
        [syllabusId, parentId || null]
      )
      orderIndex = rows[0].next_idx
    }
    const { rows } = await pool.query(
      `INSERT INTO syllabus_nodes (syllabus_id, parent_id, node_type, title, order_index)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [syllabusId, parentId || null, nodeType, title.trim(), orderIndex]
    )
    // Touch syllabus updated_at
    await pool.query(
      'UPDATE syllabus SET updated_at = NOW() WHERE id = $1',
      [syllabusId]
    )
    return rows[0]
  },

  async updateNode(nodeId, { title, orderIndex }) {
    const { rows } = await pool.query(
      `UPDATE syllabus_nodes
       SET title       = COALESCE($1, title),
           order_index = COALESCE($2, order_index),
           updated_at  = NOW()
       WHERE id = $3
       RETURNING *`,
      [title?.trim() || null, orderIndex ?? null, nodeId]
    )
    return rows[0] || null
  },

  async deleteNode(nodeId) {
    // CASCADE deletes children via FK
    await pool.query('DELETE FROM syllabus_nodes WHERE id = $1', [nodeId])
  },

  /**
   * Gap analysis: return all nodes with resource_count = 0
   */
  async getGapNodes(classroomId) {
    const { rows } = await pool.query(
      `SELECT sn.*, COUNT(r.id)::int AS resource_count
       FROM syllabus_nodes sn
       JOIN syllabus s ON s.id = sn.syllabus_id
       LEFT JOIN resources r ON r.syllabus_node_id = sn.id
       WHERE s.classroom_id = $1
       GROUP BY sn.id
       HAVING COUNT(r.id) = 0
       ORDER BY sn.node_type, sn.order_index`,
      [classroomId]
    )
    return rows
  },

  async findNodeById(nodeId) {
    const { rows } = await pool.query(
      'SELECT * FROM syllabus_nodes WHERE id = $1',
      [nodeId]
    )
    return rows[0] || null
  },

  async getSyllabusByClassroom(classroomId) {
    const { rows } = await pool.query(
      'SELECT * FROM syllabus WHERE classroom_id = $1',
      [classroomId]
    )
    return rows[0] || null
  },
}
