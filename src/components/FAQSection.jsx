import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { springs } from '../motion/config'

const faqs = [
    {
        question: "How to Generate the Perfect Reply",
        answer: (
            <ul className="space-y-3 list-disc pl-5 text-gray-600">
                <li><strong>Paste the text:</strong> Copy the message you received (Email, SMS, or DM) into the input box.</li>
                <li><strong>Choose your vibe:</strong> Select "Professional" for work, "Funny" for friends, or "Polite" for formal situations.</li>
                <li><strong>Click Generate:</strong> In seconds, you get multiple reply options ready to copy and paste.</li>
            </ul>
        )
    },
    {
        question: "Is this AI Reply Tool Free?",
        answer: "Yes! We offer a free version that allows you to generate high-quality responses daily. For power users who need unlimited replies, we offer affordable premium plans. This tool is designed to be the fastest free AI text reply generator on the market."
    },
    {
        question: "Is my data private?",
        answer: "Yes. We do not store your personal messages. All processing is done securely via AI API and discarded."
    }
]

export default function FAQSection() {
    return (
        <section className="mb-20 max-w-4xl mx-auto px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', ...springs.smooth }}
                className="space-y-4"
            >
                {faqs.map((faq, index) => (
                    <details
                        key={index}
                        className="group bg-white/50 backdrop-blur-sm rounded-2xl border border-white/20 shadow-sm overflow-hidden open:pb-6 transition-all duration-300"
                    >
                        <summary className="flex items-center justify-between p-6 cursor-pointer list-none select-none">
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-pink-600 transition-colors">
                                {faq.question}
                            </h3>
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:bg-pink-50 transition-colors">
                                <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-pink-500 group-open:rotate-180 transition-transform duration-300" />
                            </div>
                        </summary>
                        <div className="px-6 text-gray-600 leading-relaxed animate-in slide-in-from-top-2 opacity-0 group-open:opacity-100 transition-opacity duration-500">
                            {faq.answer}
                        </div>
                    </details>
                ))}
            </motion.div>

            <style>{`
                details > summary::-webkit-details-marker {
                    display: none;
                }
            `}</style>
        </section>
    )
}
