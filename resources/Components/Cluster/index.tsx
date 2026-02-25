import React from 'react'

interface ClusterValueProps {
  children: React.ReactNode
  style?: React.CSSProperties
  onClick?: (() => void) | null
  grow?: number
  pointerEvents?: boolean | string
  transparent?: boolean
  role?: string
}

export const ClusterValue: React.FC<ClusterValueProps> = ({
  children,
  style = {},
  onClick,
  grow = 1,
  pointerEvents = false,
  transparent = false,
  role
}) => {
  let valueClass = 'clusterValue'
  if (onClick) valueClass += ' clusterValueClickable'
  if (pointerEvents) valueClass += ' clusterValueInteractable'
  if (transparent) valueClass += ' clusterValueTransparent'
  style.flexGrow = grow
  return (
    <div className={valueClass} style={style} onClick={onClick || undefined} role={role}>
      {children}
    </div>
  )
}

interface ClusterRowProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

export const ClusterRow: React.FC<ClusterRowProps> = ({ children, style = {} }) => {
  return (
    <div className='clusterRow' style={style}>
      {children}
    </div>
  )
}

interface ClusterColumnProps {
  children: React.ReactNode
  style?: React.CSSProperties
  grow?: number
  width?: string
}

export const ClusterColumn: React.FC<ClusterColumnProps> = ({ children, style = {}, grow = 1, width }) => {
  style.flexGrow = grow
  if (width) {
    style.width = width
    style.minWidth = width
    style.maxWidth = width
  }
  return (
    <div className='clusterColumn' style={style}>
      {children}
    </div>
  )
}

interface ClusterProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

export const Cluster: React.FC<ClusterProps> = ({ children, style = {} }) => {
  return (
    <div className='cluster' style={style}>
      {children}
    </div>
  )
}

interface ClusterBoxProps {
  title?: string
  subtitle?: string
  children: React.ReactNode
  style?: React.CSSProperties
  animationSlot?: number
}

export const ClusterBox: React.FC<ClusterBoxProps> = ({ title, subtitle, children, style = {}, animationSlot = 0 }) => {
  style.animationDelay = 0.1 * animationSlot + 's'
  return (
    <div className='_txMain' style={style}>
      <div className='_txMainInner'>
        {title ? (
          <div className='_txLabel'>
            <div>{title}</div>
            {subtitle && (
              <span
                style={{
                  opacity: 0.9,
                  fontSize: '9px',
                  position: 'relative',
                  top: '0px',
                  left: '4px'
                }}
              >
                {`(${subtitle})`}
              </span>
            )}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}
