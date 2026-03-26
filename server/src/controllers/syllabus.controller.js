import { SyllabusModel } from '../models/syllabus.model.js'

/**
 * GET /api/syllabus/:classroomId
 * Returns the full syllabus tree (creates an empty one if it doesn't exist yet)
 */
export const getSyllabusTree = async (req, res) => {
  const { classroomId } = req.params
  const result = await SyllabusModel.getTree(classroomId)
  if (!result) {
    // No syllabus yet — return empty structure
    return res.json({ syllabusId: null, nodes: [] })
  }
  res.json(result)
}

/**
 * POST /api/syllabus/:classroomId/nodes
 * Add a unit/topic/subtopic (professor only)
 */
export const addNode = async (req, res) => {
  const { classroomId } = req.params
  const { node_type, title, parent_id, order_index } = req.body

  if (!node_type || !title?.trim()) {
    return res.status(400).json({ error: 'node_type and title are required' })
  }
  if (!['unit', 'topic', 'subtopic'].includes(node_type)) {
    return res.status(400).json({ error: "node_type must be 'unit', 'topic', or 'subtopic'" })
  }

  // Get or create the syllabus
  const syllabus = await SyllabusModel.getOrCreate(classroomId, req.user.id)

  const node = await SyllabusModel.addNode({
    syllabusId: syllabus.id,
    parentId: parent_id || null,
    nodeType: node_type,
    title,
    orderIndex: order_index,
  })
  res.status(201).json({ node })
}

/**
 * PUT /api/syllabus/nodes/:nodeId
 * Update a node title or order (professor only)
 */
export const updateNode = async (req, res) => {
  const { nodeId } = req.params
  const { title, order_index } = req.body

  const existing = await SyllabusModel.findNodeById(nodeId)
  if (!existing) {
    return res.status(404).json({ error: 'Node not found' })
  }

  const node = await SyllabusModel.updateNode(nodeId, {
    title,
    orderIndex: order_index,
  })
  res.json({ node })
}

/**
 * DELETE /api/syllabus/nodes/:nodeId
 * Delete a node and all its children (professor only)
 */
export const deleteNode = async (req, res) => {
  const { nodeId } = req.params
  const existing = await SyllabusModel.findNodeById(nodeId)
  if (!existing) {
    return res.status(404).json({ error: 'Node not found' })
  }
  await SyllabusModel.deleteNode(nodeId)
  res.json({ message: 'Node deleted successfully' })
}

/**
 * GET /api/syllabus/:classroomId/gap-analysis
 * Returns all nodes with zero resources
 */
export const getGapAnalysis = async (req, res) => {
  const { classroomId } = req.params
  const gapNodes = await SyllabusModel.getGapNodes(classroomId)
  const total = await SyllabusModel.getTree(classroomId)
  const totalCount = total?.nodes?.length || 0
  const gapCount = gapNodes.length
  const coveragePercent = totalCount === 0
    ? 100
    : Math.round(((totalCount - gapCount) / totalCount) * 100)

  res.json({
    gap_nodes: gapNodes,
    total_nodes: totalCount,
    covered_nodes: totalCount - gapCount,
    gap_count: gapCount,
    coverage_percent: coveragePercent,
  })
}
