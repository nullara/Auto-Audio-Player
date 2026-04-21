
import { app } from '../../scripts/app.js'

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function getPayload(message) {
  const direct = Array.isArray(message?.audio) ? message.audio[0] : message?.audio
  if (direct?.url) return direct

  const nestedUi = Array.isArray(message?.ui?.audio) ? message.ui.audio[0] : message?.ui?.audio
  if (nestedUi?.url) return nestedUi

  const nestedResult = Array.isArray(message?.result?.ui?.audio) ? message.result.ui.audio[0] : message?.result?.ui?.audio
  if (nestedResult?.url) return nestedResult

  return null
}

function styleRange(input) {
  input.style.width = '100%'
  input.style.margin = '0'
  input.style.minWidth = '0'
  input.style.accentColor = '#b866ff'
}

function findWidget(node, name) {
  return node.widgets?.find((w) => w?.name === name) || null
}

function setWidgetValue(widget, value, node) {
  if (!widget) return
  widget.value = value
  if (typeof widget.callback === 'function') widget.callback(value)
  if (typeof node?.setDirtyCanvas === 'function') node.setDirtyCanvas(true, true)
}

function hideWidget(widget) {
  if (!widget || widget.__autoAudioHidden) return
  widget.__autoAudioHidden = true
  widget.hidden = true
  widget.type = 'converted-widget'
  widget.computeSize = () => [0, 0]
  widget.draw = () => {}
  widget.mouse = () => false
  widget.serializeValue = () => widget.value
  if (widget.element) {
    widget.element.style.display = 'none'
  }
}

app.registerExtension({
  name: 'custom.auto_audio_player',

  async beforeRegisterNodeDef(nodeType, nodeData) {
    const nodeName = nodeData?.name || nodeData?.display_name || nodeType?.comfyClass || nodeType?.type
    if (nodeName !== 'AutoAudioPlayer') return

    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function () {
      const result = onNodeCreated?.apply(this, arguments)

      if (this.__autoAudioPlayerInitialized) return result
      this.__autoAudioPlayerInitialized = true

      const autoplayWidget = findWidget(this, 'autoplay')
      const volumeWidget = findWidget(this, 'default_volume')
      const loopWidget = findWidget(this, 'loop')
      hideWidget(autoplayWidget)
      hideWidget(volumeWidget)
      hideWidget(loopWidget)

      requestAnimationFrame(() => {
        hideWidget(autoplayWidget)
        hideWidget(volumeWidget)
        hideWidget(loopWidget)
        this.setDirtyCanvas?.(true, true)
      })

      const container = document.createElement('div')
      container.style.display = 'flex'
      container.style.flexDirection = 'column'
      container.style.gap = '10px'
      container.style.padding = '12px'
      container.style.width = '100%'
      container.style.boxSizing = 'border-box'
      container.style.background = 'rgba(255,255,255,0.04)'
      container.style.border = '1px solid rgba(255,255,255,0.08)'
      container.style.borderRadius = '12px'
      container.style.color = '#e8e8ea'
      container.style.fontSize = '12px'
      container.style.fontFamily = 'inherit'
      container.style.overflow = 'hidden'

      const status = document.createElement('div')
      status.textContent = 'Waiting for audio...'
      status.style.fontSize = '12px'
      status.style.lineHeight = '1.35'
      status.style.fontWeight = '600'
      status.style.opacity = '0.95'
      status.style.wordBreak = 'break-word'

      const audio = document.createElement('audio')
      audio.preload = 'auto'
      audio.style.display = 'none'

      const playRow = document.createElement('div')
      playRow.style.display = 'grid'
      playRow.style.gridTemplateColumns = '64px minmax(0,1fr) auto'
      playRow.style.alignItems = 'center'
      playRow.style.columnGap = '10px'
      playRow.style.rowGap = '6px'

      const playPauseButton = document.createElement('button')
      playPauseButton.textContent = 'Play'
      playPauseButton.style.height = '34px'
      playPauseButton.style.minWidth = '64px'
      playPauseButton.style.padding = '0 12px'
      playPauseButton.style.border = '1px solid rgba(255,255,255,0.10)'
      playPauseButton.style.borderRadius = '10px'
      playPauseButton.style.background = 'rgba(255,255,255,0.10)'
      playPauseButton.style.color = '#f2f2f3'
      playPauseButton.style.cursor = 'pointer'
      playPauseButton.style.fontWeight = '700'
      playPauseButton.style.fontSize = '12px'
      playPauseButton.style.lineHeight = '1'

      const progress = document.createElement('input')
      progress.type = 'range'
      progress.min = '0'
      progress.max = '1000'
      progress.step = '1'
      progress.value = '0'
      styleRange(progress)

      const timeLabel = document.createElement('div')
      timeLabel.textContent = '0:00 / 0:00'
      timeLabel.style.fontSize = '12px'
      timeLabel.style.opacity = '0.92'
      timeLabel.style.minWidth = '78px'
      timeLabel.style.textAlign = 'right'
      timeLabel.style.fontVariantNumeric = 'tabular-nums'
      timeLabel.style.whiteSpace = 'nowrap'
      timeLabel.style.fontWeight = '600'

      playRow.append(playPauseButton, progress, timeLabel)

      const controlsGrid = document.createElement('div')
      controlsGrid.style.display = 'grid'
      controlsGrid.style.gridTemplateColumns = '64px minmax(0,1fr) auto'
      controlsGrid.style.alignItems = 'center'
      controlsGrid.style.columnGap = '10px'
      controlsGrid.style.rowGap = '10px'

      const volumeLabel = document.createElement('div')
      volumeLabel.textContent = 'Vol'
      volumeLabel.style.fontWeight = '700'
      volumeLabel.style.opacity = '0.95'

      const volume = document.createElement('input')
      volume.type = 'range'
      volume.min = '0'
      volume.max = '1'
      volume.step = '0.01'
      volume.value = String(volumeWidget?.value ?? 1)
      styleRange(volume)

      const loopWrap = document.createElement('label')
      loopWrap.style.display = 'inline-flex'
      loopWrap.style.alignItems = 'center'
      loopWrap.style.justifySelf = 'end'
      loopWrap.style.gap = '6px'
      loopWrap.style.whiteSpace = 'nowrap'
      loopWrap.style.cursor = 'pointer'
      loopWrap.style.userSelect = 'none'
      loopWrap.style.fontWeight = '700'

      const loopToggle = document.createElement('input')
      loopToggle.type = 'checkbox'
      loopToggle.style.margin = '0'
      loopToggle.style.accentColor = '#b866ff'
      loopToggle.checked = !!loopWidget?.value

      const loopText = document.createElement('span')
      loopText.textContent = 'Loop'

      loopWrap.append(loopToggle, loopText)

      const autoplayLabel = document.createElement('div')
      autoplayLabel.textContent = 'Autoplay'
      autoplayLabel.style.fontWeight = '700'
      autoplayLabel.style.opacity = '0.95'

      const autoplayToggleWrap = document.createElement('label')
      autoplayToggleWrap.style.display = 'inline-flex'
      autoplayToggleWrap.style.alignItems = 'center'
      autoplayToggleWrap.style.justifySelf = 'start'
      autoplayToggleWrap.style.gap = '6px'
      autoplayToggleWrap.style.cursor = 'pointer'
      autoplayToggleWrap.style.userSelect = 'none'
      autoplayToggleWrap.style.fontWeight = '700'

      const autoplayToggle = document.createElement('input')
      autoplayToggle.type = 'checkbox'
      autoplayToggle.style.margin = '0'
      autoplayToggle.style.accentColor = '#b866ff'
      autoplayToggle.checked = autoplayWidget?.value !== false

      autoplayToggleWrap.append(autoplayToggle)

      const spacer = document.createElement('div')
      spacer.style.minWidth = '1px'

      controlsGrid.append(volumeLabel, volume, loopWrap, autoplayLabel, autoplayToggleWrap, spacer)

      container.append(status, playRow, controlsGrid, audio)

      this.addDOMWidget('auto_audio_player', 'auto_audio_player', container)
      this.size = [Math.max(this.size?.[0] || 320, 360), Math.max(this.size?.[1] || 220, 200)]
      this.setDirtyCanvas(true, true)

      const syncButtonLabel = () => {
        playPauseButton.textContent = audio.paused ? 'Play' : 'Pause'
      }

      const syncTimeLabel = () => {
        const current = audio.currentTime || 0
        const total = Number.isFinite(audio.duration) ? audio.duration : 0
        timeLabel.textContent = `${formatTime(current)} / ${formatTime(total)}`
      }

      const syncProgress = () => {
        const total = Number.isFinite(audio.duration) ? audio.duration : 0
        if (total <= 0) {
          progress.value = '0'
          return
        }
        progress.value = String(Math.round((audio.currentTime / total) * 1000))
      }

      playPauseButton.onclick = async () => {
        if (!audio.src) return
        try {
          if (audio.paused) {
            await audio.play()
          } else {
            audio.pause()
          }
        } catch (err) {
          console.warn('[AutoAudioPlayer] play/pause error:', err)
        }
        syncButtonLabel()
      }

      progress.oninput = () => {
        const total = Number.isFinite(audio.duration) ? audio.duration : 0
        if (total <= 0) return
        audio.currentTime = (Number(progress.value) / 1000) * total
        syncTimeLabel()
      }

      volume.oninput = () => {
        const value = Number(volume.value)
        audio.volume = value
        setWidgetValue(volumeWidget, value, this)
      }

      loopToggle.onchange = () => {
        audio.loop = loopToggle.checked
        setWidgetValue(loopWidget, loopToggle.checked, this)
      }

      autoplayToggle.onchange = () => {
        setWidgetValue(autoplayWidget, autoplayToggle.checked, this)
      }

      audio.addEventListener('play', syncButtonLabel)
      audio.addEventListener('pause', syncButtonLabel)
      audio.addEventListener('timeupdate', () => {
        syncProgress()
        syncTimeLabel()
      })
      audio.addEventListener('loadedmetadata', () => {
        syncProgress()
        syncTimeLabel()
      })
      audio.addEventListener('ended', () => {
        syncButtonLabel()
        syncProgress()
        syncTimeLabel()
      })

      this.__autoAudioPlayer = {
        status,
        audio,
        progress,
        volume,
        loopToggle,
        autoplayToggle,
        syncButtonLabel,
        syncProgress,
        syncTimeLabel,
      }

      return result
    }

    const onExecuted = nodeType.prototype.onExecuted
    nodeType.prototype.onExecuted = function (message) {
      onExecuted?.apply(this, arguments)

      const ui = this.__autoAudioPlayer
      if (!ui) return

      const payload = getPayload(message)
      if (!payload?.url) {
        ui.status.textContent = 'Execution finished, but no audio preview payload was returned.'
        console.warn('[AutoAudioPlayer] No usable payload found', message)
        return
      }

      const cacheBustedUrl = `${payload.url}${payload.url.includes('?') ? '&' : '?'}t=${Date.now()}`
      const preferredVolume = Number.isFinite(Number(findWidget(this, 'default_volume')?.value))
        ? Number(findWidget(this, 'default_volume')?.value)
        : Number.isFinite(Number(ui.volume.value))
          ? Number(ui.volume.value)
          : Number(payload.default_volume ?? 1)

      const preferredLoop = findWidget(this, 'loop')?.value ?? payload.loop
      const preferredAutoplay = findWidget(this, 'autoplay')?.value ?? payload.autoplay

      ui.audio.pause()
      ui.audio.src = cacheBustedUrl
      ui.audio.load()

      ui.volume.value = String(preferredVolume)
      ui.audio.volume = preferredVolume

      ui.loopToggle.checked = !!preferredLoop
      ui.audio.loop = ui.loopToggle.checked

      ui.autoplayToggle.checked = preferredAutoplay !== false

      const durationText = Number.isFinite(payload.duration) ? formatTime(payload.duration) : '0:00'
      ui.status.textContent = `Audio ready • ${payload.sample_rate ?? '?'} Hz • ${payload.channels ?? '?'} ch • ${durationText}`
      ui.syncButtonLabel()
      ui.syncProgress()
      ui.syncTimeLabel()

      if (preferredAutoplay) {
        ui.audio.play().catch((err) => {
          console.warn('[AutoAudioPlayer] Autoplay blocked or failed:', err)
          ui.status.textContent += ' • Autoplay blocked by browser until you interact with the page.'
          ui.syncButtonLabel()
        })
      }

      this.setDirtyCanvas(true, true)
    }
  }
})
