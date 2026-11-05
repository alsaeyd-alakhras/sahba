// Fixed, neutral sample deck (productivity habits) used to preview templates and identity.
const AR = {
  slug: 'sample_productivity', category: 'إنتاجية', lang: 'ar', template: 'editorial',
  caption: '٥ عادات بتوفّرلك ساعة كل يوم ⏳\n\nمش محتاج تطبيقات جديدة — محتاج ترتيب بسيط لليوم.\nجرّب عادة وحدة هالأسبوع وشوف الفرق.\n\nاحفظ البوست وعلّق: أي عادة رح تبدأ فيها؟ 👇\n\n#إنتاجية #تنظيم_الوقت #عادات #تركيز #تطوير_الذات',
  slides: [
    { kind: 'cover', headline: '{b}٥{/b} عادات بتوفّرلك<br>{c}ساعة{/c} كل يوم', sub: 'إنتاجية بدون تطبيقات معقدة', size: 100,
      art: 'window', icons: ['Timer', 'CalendarCheck', 'ListChecks'], labels: ['ساعة إضافية', 'يوم مرتب'] },
    { kind: 'stat', icon: 'Hourglass', kicker: 'الأرقام', value: 23, unit: 'min', fill: 64,
      title: 'دقيقة لترجع<br>{b}لتركيزك{/b}', body: 'بعد كل إشعار بيقطع شغلك' },
    { kind: 'point', icon: 'BellOff', kicker: 'عادة ١', title: 'صفّر الإشعارات',
      body: 'اطفي كل إشعار مش ضروري، وافتح الرسائل {l}مرتين باليوم{/l} بس.',
      art: 'stack', icons: ['Bell', 'Inbox', 'MessageSquare'], labels: ['تنبيهات', 'بريد', 'رسائل'], artAt: { left: 320, top: 150, scale: 0.8 } },
    { kind: 'list', icon: 'ListChecks', kicker: 'عادة ٢', title: 'خطّط يومك بالليل',
      items: [
        { icon: 'Moon', t: '{l}قبل النوم:{/l} ٣ مهام بس لبكرا' },
        { icon: 'Star', t: '{l}الأهم أولاً:{/l} أصعب مهمة الصبح' },
        { icon: 'Clock', t: '{l}وقت محدد:{/l} ساعة لكل مهمة' },
      ] },
    { kind: 'rule', icon: 'BadgeCheck', kicker: 'القاعدة', quote: 'مهمة {b}وحدة{/b}<br>بوقت {b}واحد{/b}',
      flow: [{ icon: 'Target', t: 'ركّز' }, { icon: 'CircleCheckBig', t: 'خلّص' }] },
    { kind: 'bars', icon: 'Timer', kicker: 'قبل وبعد', title: 'وقت إنجاز المهمة', suffix: ' د',
      items: [{ label: 'مع تشتيت', value: 90 }, { label: 'تركيز كامل', value: 35, hot: true }],
      body: 'نفس الشغل — {m}بأقل من النص{/m}' },
    { kind: 'steps', icon: 'Repeat', kicker: 'عادة ٣', title: 'طريقة بومودورو',
      items: [
        { icon: 'Timer', t: 'اشتغل {l}٢٥ دقيقة{/l}' },
        { icon: 'Coffee', t: 'استراحة {l}٥ دقايق{/l}' },
        { icon: 'Repeat', t: 'كرّرها {l}٤ مرات{/l}' },
      ] },
    { kind: 'compare', title: 'يومك قبل وبعد',
      right: { title: 'قبل', items: ['مهام مبعثرة', 'إشعارات طول اليوم', 'تعب بلا إنجاز'] },
      left: { title: 'بعد', items: ['٣ مهام واضحة', 'تركيز بأوقات ثابتة', 'إنجاز بتحسّه'] } },
    { kind: 'quote', quote: 'مش لازم تشتغل {b}أكثر{/b}<br>لازم تشتغل {m}أذكى{/m}', source: 'خلاصة العادات',
      art: 'orbit', icons: ['Brain', 'Timer', 'ListChecks', 'Coffee', 'Moon'], artAt: { left: 330, top: 960, scale: 0.6 } },
    { kind: 'cta', headline: 'أي عادة رح<br>{c}تبدأ{/c} فيها؟', prompt: 'اكتبلي رقمها بالتعليقات 👇', save: true },
  ],
};

const EN = {
  slug: 'sample_productivity_en', category: 'Productivity', lang: 'en', template: 'editorial',
  caption: '5 habits that give you back an hour a day ⏳\n\nNo new apps — just a simpler day.\nTry one habit this week and feel the difference.\n\nSave this and comment: which habit will you start? 👇\n\n#productivity #timemanagement #habits #focus #selfimprovement',
  slides: [
    { kind: 'cover', headline: '{b}5{/b} habits for<br>an extra {c}hour{/c}', sub: 'Productivity without complicated apps', size: 100,
      art: 'window', icons: ['Timer', 'CalendarCheck', 'ListChecks'], labels: ['+1 hour', 'Calm day'] },
    { kind: 'stat', icon: 'Hourglass', kicker: 'The numbers', value: 23, unit: 'min', fill: 64,
      title: 'minutes to get<br>your {b}focus{/b} back', body: 'after every notification that breaks your flow' },
    { kind: 'point', icon: 'BellOff', kicker: 'Habit 1', title: 'Mute notifications',
      body: 'Turn off everything that is not urgent, and check messages {l}twice a day{/l}.',
      art: 'stack', icons: ['Bell', 'Inbox', 'MessageSquare'], labels: ['Alerts', 'Mail', 'Chat'], artAt: { left: 320, top: 150, scale: 0.8 } },
    { kind: 'list', icon: 'ListChecks', kicker: 'Habit 2', title: 'Plan tomorrow tonight',
      items: [
        { icon: 'Moon', t: '{l}Before bed:{/l} just 3 tasks' },
        { icon: 'Star', t: '{l}Hardest first:{/l} in the morning' },
        { icon: 'Clock', t: '{l}Time-boxed:{/l} one hour each' },
      ] },
    { kind: 'rule', icon: 'BadgeCheck', kicker: 'The rule', quote: '{b}One{/b} task<br>at a {b}time{/b}',
      flow: [{ icon: 'Target', t: 'Focus' }, { icon: 'CircleCheckBig', t: 'Finish' }] },
    { kind: 'bars', icon: 'Timer', kicker: 'Before & after', title: 'Time to finish a task', suffix: ' min',
      items: [{ label: 'Distracted', value: 90 }, { label: 'Fully focused', value: 35, hot: true }],
      body: 'Same work — {m}in less than half{/m}' },
    { kind: 'steps', icon: 'Repeat', kicker: 'Habit 3', title: 'The Pomodoro method',
      items: [
        { icon: 'Timer', t: 'Work for {l}25 minutes{/l}' },
        { icon: 'Coffee', t: 'Take a {l}5 minute{/l} break' },
        { icon: 'Repeat', t: 'Repeat {l}4 times{/l}' },
      ] },
    { kind: 'compare', title: 'Your day, before and after',
      right: { title: 'Before', items: ['Scattered tasks', 'Pings all day', 'Tired, nothing done'] },
      left: { title: 'After', items: ['3 clear tasks', 'Fixed focus blocks', 'Progress you feel'] } },
    { kind: 'quote', quote: 'Work {m}smarter{/m},<br>not {b}harder{/b}', source: 'The takeaway',
      art: 'orbit', icons: ['Brain', 'Timer', 'ListChecks', 'Coffee', 'Moon'], artAt: { left: 330, top: 960, scale: 0.6 } },
    { kind: 'cta', headline: 'Which habit will<br>you {c}start{/c}?', prompt: 'Tell me its number in the comments 👇', save: true },
  ],
};

export function sampleDeck(lang = 'ar') {
  return structuredClone(lang === 'en' ? EN : AR);
}
