import { useCallback, useEffect, useRef, useState } from 'react'
import { directoryOpen } from 'browser-fs-access'
import { XMLParser } from 'fast-xml-parser'

import MapImage from './map.png'

const WIDTH = 8417
const HEIGHT = 5000
const OFFSET_X = 3910
const OFFSET_Y = 480
const SCALE = 3.7
const MARKER_SIZE = 20
const MARKER_STROKE_WIDTH = 10
const MARKER_STROKE_COLOR = 'red'
const MARKER_FILL = 'white'

const convertCoords = (x, y) => ({
  x: x / SCALE + OFFSET_X,
  y: y / SCALE + OFFSET_Y
})

const xmlParser = new XMLParser({ ignoreAttributes: false })

const blobToSession = async (blob) => {
  const text = await blob.text()
  const stats = xmlParser.parse(text).Stats.stats

  const x = Number(stats?.['@_death_pos.x'])
  const y = Number(stats?.['@_death_pos.y'])
  const killedBy = stats?.['@_killed_by']

  if (!x || !y || !killedBy) return null

  return { x, y, killedBy }
}

const isStatsXml = (blob) =>
  blob.name.endsWith('stats.xml')

function App () {
  const canvasEl = useRef(null)
  const [sessions, setSessions] = useState(null)
  const [killedByStats, setKilledByStats] = useState({})
  const [isMapLoaded, setIsMapLoaded] = useState(false)

  const pickDirectory = useCallback(
    async () => {
      try {
        const dirContents = await directoryOpen({ recursive: false })
        const parsedSessions = await Promise.all(
          dirContents
            .filter(isStatsXml)
            .map(blobToSession)
        )
        const validSessions = parsedSessions.filter(Boolean)

        const stats = validSessions.reduce((acc, session) => {
          const { killedBy } = session
          acc[killedBy] = (acc[killedBy] || 0) + 1
          return acc
        }, {})

        setSessions(validSessions)
        setKilledByStats(stats)
      } catch (error) {
        console.error('Error processing directory:', error)
      }
    },
    []
  )

  useEffect(() => {
    if (!canvasEl.current || !sessions) {
      setIsMapLoaded(false)
      return
    }

    const ctx = canvasEl.current.getContext('2d')

    const mapImg = new Image()
    mapImg.src = MapImage
    mapImg.onload = () => {
      ctx.drawImage(mapImg, 0, 0)
      ctx.fillStyle = MARKER_FILL
      ctx.strokeStyle = MARKER_STROKE_COLOR
      ctx.lineWidth = MARKER_STROKE_WIDTH

      for (const session of sessions) {
        const { x, y } = session
        const imgCoords = convertCoords(x, y)
        ctx.beginPath()
        ctx.arc(
          imgCoords.x,
          imgCoords.y,
          MARKER_SIZE,
          0,
          2 * Math.PI,
          false
        )
        ctx.fill()
        ctx.stroke()
      }
      setIsMapLoaded(true)
    }
    mapImg.onerror = () => {
      console.error('Failed to load map image')
      setIsMapLoaded(false)
    }
  }, [sessions])

  const handleDownload = () => {
    if (!canvasEl.current) return

    const dataUrl = canvasEl.current.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = 'noita_map.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const sortedStats = Object.entries(killedByStats).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })

  const formatKilledBy = (killedBy) => {
    const cleaned = killedBy.replace(/^[\s|]+/, '')
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }

  return (
    <>
      <button onClick={pickDirectory}>
        Open your Noita sessions folder
      </button>

      <div>
        <canvas
          ref={canvasEl}
          id='map'
          width={WIDTH}
          height={HEIGHT}
        />
      </div>

      {isMapLoaded && (
        <button onClick={handleDownload}>Download</button>
      )}

      <section id="stats" style={{ marginTop: '20px' }}>
        <h3>Death Reason Statistics</h3>
        <div id="stats-content" style={{ fontSize: '16px' }}>
          {sortedStats.length > 0 ? (
            <ul style={{ listStyleType: 'none', padding: 0 }}>
              {sortedStats.map(([killedBy, count]) => (
                <li key={killedBy} style={{ marginBottom: '8px' }}>
                  {formatKilledBy(killedBy)}: {count}
                </li>
              ))}
            </ul>
          ) : (
            <p>No statistics available yet...</p>
          )}
        </div>
      </section>
    </>
  )
}

export default App