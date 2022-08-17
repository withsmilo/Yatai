import { ScrollFollow } from 'react-lazylog'
import { formatMoment } from '@/utils/datetime'
import useTranslation from '@/hooks/useTranslation'
import { IWsRespSchema } from '@/schemas/websocket'
import { getEventTime, IKubeEventSchema } from '@/schemas/kube_event'
import qs from 'qs'
import { useEffect, useRef, useState } from 'react'
import { toaster } from 'baseui/toast'
import { useOrganization } from '@/hooks/useOrganization'
import LazyLog from './LazyLog'

interface IKubePodEventsProps {
    clusterName: string
    deploymentName?: string
    namespace: string
    podName?: string
    open?: boolean
    width?: number | 'auto'
    height?: number | string
}

export default function KubePodEvents({
    clusterName,
    deploymentName,
    namespace,
    podName,
    open,
    width,
    height,
}: IKubePodEventsProps) {
    const { organization } = useOrganization()

    const wsUrl = deploymentName
        ? `${window.location.protocol === 'http:' ? 'ws:' : 'wss:'}//${
              window.location.host
          }/ws/v1/clusters/${clusterName}/namespaces/${namespace}/deployments/${deploymentName}/kube_events${qs.stringify(
              {
                  pod_name: podName,
                  organization_name: organization?.name,
              },
              {
                  addQueryPrefix: true,
              }
          )}`
        : `${window.location.protocol === 'http:' ? 'ws:' : 'wss:'}//${
              window.location.host
          }/ws/v1/clusters/${clusterName}/kube_events${qs.stringify(
              {
                  namespace,
                  pod_name: podName,
                  organization_name: organization?.name,
              },
              {
                  addQueryPrefix: true,
              }
          )}`

    const [t] = useTranslation()

    const [items, setItems] = useState<string[]>([])
    const wsRef = useRef(null as null | WebSocket)
    const wsOpenRef = useRef(false)

    useEffect(() => {
        if (!open) {
            return undefined
        }
        let ws: WebSocket | undefined
        let selfClose = false
        const connect = () => {
            ws = new WebSocket(wsUrl)
            selfClose = false
            ws.onmessage = (e) => {
                const resp = JSON.parse(e.data) as IWsRespSchema<IKubeEventSchema[]>
                if (resp.type !== 'success') {
                    toaster.negative(resp.message, {})
                    return
                }
                const events = resp.payload
                if (events.length === 0) {
                    setItems([t('no event')])
                    return
                }
                setItems(
                    events.map((event) => {
                        const eventTime = getEventTime(event)
                        const eventTimeStr = eventTime ? formatMoment(eventTime) : '-'
                        if (podName) {
                            return `[${eventTimeStr}] [${event.reason}] ${event.message}`
                        }
                        return `[${eventTimeStr}] [${event.involvedObject?.kind ?? '-'}] [${
                            event.involvedObject?.name ?? '-'
                        }] [${event.reason}] ${event.message}`
                    })
                )
            }
            ws.onopen = () => {
                wsOpenRef.current = true
                if (ws) {
                    wsRef.current = ws
                }
            }
            ws.onclose = () => {
                wsOpenRef.current = false
                if (selfClose) {
                    return
                }
                setTimeout(connect, 3000)
            }
        }
        connect()
        return () => {
            ws?.close()
            selfClose = true
            wsRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wsUrl, open])

    return (
        <div style={{ height }}>
            <ScrollFollow
                startFollowing
                render={({ follow }) => (
                    <LazyLog
                        caseInsensitive
                        enableSearch
                        selectableLines
                        width={width}
                        text={items.length > 0 ? items.join('\n') : ' '}
                        follow={follow}
                    />
                )}
            />
        </div>
    )
}
