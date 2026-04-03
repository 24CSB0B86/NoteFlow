import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { FileText, Wand2, Loader2, Play, CheckCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import api from '../../lib/api'

export default function AITestGeneratorModal({ open, onClose, sectionId, resources, onGenerated }) {
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState('30')
  const [prompt, setPrompt] = useState('')
  const [selectedResources, setSelectedResources] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setTitle('')
      setDuration('30')
      setPrompt('')
      setSelectedResources([])
      setError('')
    }
  }, [open])

  const toggleResource = (resId) => {
    setSelectedResources(prev => 
      prev.includes(resId) ? prev.filter(r => r !== resId) : [...prev, resId]
    )
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!prompt.trim()) return setError('Please provide instructions for the AI')
    
    setIsGenerating(true)
    setError('')
    
    try {
      const payload = {
        title: title || 'AI Generated Test',
        duration_mins: parseInt(duration),
        prompt,
        resourceIds: selectedResources
      }
      
      const { data } = await api.post(`/api/exam/section/${sectionId}/tests/generate`, payload)
      onGenerated(data.test)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  // Filter only PDF resources (as our backend parser currently targets PDFs)
  const pdfResources = (resources || []).filter(r => r.file_type.includes('pdf'))

  return (
    <Dialog open={open} onOpenChange={isGenerating ? undefined : onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Wand2 className="w-5 h-5" /> Generate Test with AI
          </DialogTitle>
          <DialogDescription>
            Use NoteFlow's AI to automatically generate a multiple-choice revision test based on your instructions and uploaded resources.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleGenerate} className="space-y-5 py-2">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Test Title</Label>
              <Input 
                placeholder="e.g. Midterm Unit 1-3 Review" 
                value={title} 
                onChange={e => setTitle(e.target.value)}
                disabled={isGenerating}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (Minutes)</Label>
              <Input 
                type="number" 
                value={duration} 
                onChange={e => setDuration(e.target.value)}
                disabled={isGenerating}
                min="5" max="180"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>AI Instructions (Required)</Label>
            <Textarea 
              placeholder="e.g. Generate 10 multiple choice questions focusing on CPU Scheduling algorithms, especially Round Robin. Make the difficulty level medium." 
              value={prompt} 
              onChange={e => setPrompt(e.target.value)}
              disabled={isGenerating}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Source Context (PDFs)</Label>
              <span className="text-xs text-muted-foreground">{selectedResources.length} selected</span>
            </div>
            
            {pdfResources.length === 0 ? (
              <div className="p-4 border border-dashed rounded-lg text-center text-sm text-muted-foreground">
                No PDF resources available in this section to use as context. The AI will rely on its general knowledge.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto border rounded-xl divide-y bg-muted/30">
                {pdfResources.map(res => (
                  <label key={res.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                    <input 
                      type="checkbox" 
                      className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      checked={selectedResources.includes(res.id)}
                      onChange={() => toggleResource(res.id)}
                      disabled={isGenerating}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none mb-1 truncate" title={res.file_name}>
                        {res.file_name}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        Uploaded by {res.uploader_name}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Select specific resources to ground the AI in your course material. Note: Only PDF files can be parsed currently.
            </p>
          </div>

          {error && <div className="p-3 bg-red-500/10 text-red-400 rounded-lg text-sm border border-red-500/20">{error}</div>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isGenerating}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0" disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Test...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Generate Magic
                </>
              )}
            </Button>
          </div>
          
          {isGenerating && (
            <p className="text-xs text-center text-muted-foreground animate-pulse mt-2">
              Our AI is reading your resources and crafting the perfect test. This may take up to 30 seconds...
            </p>
          )}

        </form>
      </DialogContent>
    </Dialog>
  )
}
