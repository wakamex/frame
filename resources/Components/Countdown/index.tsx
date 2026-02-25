import React from 'react'
import useCountdown from '../../Hooks/useCountdown'

interface CountdownProps {
  end: string | number | Date
  title: string
  titleClass?: string
  innerClass?: string
}

const Countdown: React.FC<CountdownProps> = ({ end, title, titleClass, innerClass }) => {
  const ttl = useCountdown(end)

  return (
    <div className={titleClass}>
      <div>{title}</div>
      <div className={innerClass} role='timer'>
        {ttl}
      </div>
    </div>
  )
}

export default Countdown
