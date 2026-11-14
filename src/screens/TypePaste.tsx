import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { useDraft } from '../lib/draft'
import { parseTyped } from '../lib/parse'
import { useStore } from '../lib/store'
import { useFlowNav } from '../nav'
import { Field, Header, Pill, Screen } from '../ui/kit'
import { colors } from '../ui/theme'

export default function TypePaste() {
  const nav = useFlowNav()
  const currency = useStore((s) => s.settings.currency)
  const [text, setText] = useState('')
  const drafts = text.trim() ? parseTyped(text, currency) : []

  const go = () => {
    useDraft.setState({ found: drafts })
    nav.replace('Review', { source: 'what you typed' })
  }

  return (
    <Screen>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: 6 }}>
        <Header title="Type or paste" left="cancel" right={<Pill label="Continue" onPress={go} disabled={!drafts.length} />} />
      </View>
      <View style={{ flex: 1, padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
        <Field value={text} onChangeText={setText} placeholder={'E.g. Netflix 15.99 monthly\nSpotify $11.99/mo on the 3rd\nAdobe 599.88 yearly'} multiline autoFocus style={{ flex: 1, backgroundColor: colors.field }} />
        <Text style={{ color: colors.dim, fontSize: 13, marginTop: 10 }}>
          {drafts.length ? `Found ${drafts.length}: ${drafts.map((d) => d.name).join(', ')}` : 'One subscription per line. Add how often you pay and the next date if you know them.'}
        </Text>
      </View>
    </KeyboardAvoidingView>
    </Screen>
  )
}
