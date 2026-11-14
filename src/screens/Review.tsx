import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { findService } from '../data/catalog'
import { formatMoney } from '../lib/currency'
import { cycleShort, formatDate } from '../lib/dates'
import { addParsed, fromParsed, startNew, useDraft } from '../lib/draft'
import type { FlowParams } from '../nav'
import { EmptyNote, Header, Page, Pill } from '../ui/kit'
import { Logo } from '../ui/Logo'
import { colors } from '../ui/theme'

/** Subscriptions an import found, to tick and add (or open one to adjust it first). */
export default function Review({ navigation, route }: NativeStackScreenProps<FlowParams, 'Review'>) {
  const found = useDraft((s) => s.found)
  const [picked, setPicked] = useState<boolean[]>(() => found.map(() => true))
  const count = picked.filter(Boolean).length

  const addAll = () => {
    addParsed(found.filter((_, i) => picked[i]))
    navigation.getParent()?.goBack()
  }

  return (
    <Page header={<Header title="Found" right={<Pill label={count ? `Add ${count}` : 'Add'} onPress={addAll} disabled={!count} />} />}>
      {found.length === 0 ? (
        <EmptyNote>
          {`Couldn't find any subscriptions in ${route.params.source}.\nTry a clearer screenshot, or add them by hand.`}
        </EmptyNote>
      ) : (
        <Text style={{ color: colors.dim, marginBottom: 12, fontSize: 14 }}>Tick the ones to add. Tap one to change its details first.</Text>
      )}
      {found.map((d, i) => {
        const svc = d.service ?? findService(d.name)
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 10 }}>
            <Pressable onPress={() => setPicked((p) => p.map((v, j) => (j === i ? !v : v)))} hitSlop={8} style={{ marginRight: 12 }}>
              <Ionicons name={picked[i] ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={picked[i] ? colors.accent : colors.faint} />
            </Pressable>
            <Pressable
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
              onPress={() => {
                startNew({ ...fromParsed(d) })
                setPicked((p) => p.map((v, j) => (j === i ? false : v)))
                navigation.navigate('Edit')
              }}
            >
              <Logo logo={svc ? { kind: 'domain', domain: svc.domain } : null} name={d.name} color={svc?.color ?? '#3b3650'} size={40} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                  {d.name}
                </Text>
                <Text style={{ color: colors.dim, fontSize: 13 }} numberOfLines={1}>
                  {[d.date ? `Next ${formatDate(d.date)}` : null, d.reason].filter(Boolean).join(' · ') || 'Tap to edit'}
                </Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 15, marginLeft: 8 }}>
                {formatMoney(d.price, d.currency)}
                <Text style={{ color: colors.dim, fontSize: 12 }}>{cycleShort(d.cycle)}</Text>
              </Text>
            </Pressable>
          </View>
        )
      })}
    </Page>
  )
}
