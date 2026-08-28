package com.moosiac.print

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.PrintManager
import android.print.pdf.PrintedPdfDocument
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.io.FileOutputStream

/**
 * Android's print service, which wants a drawing rather than a document.
 *
 * `PrintedPdfDocument` hands back a `Canvas` per page and serialises what is
 * drawn on it to the descriptor the framework supplies. The app never authors
 * a PDF — it renders each page with the same Skia renderer the editor draws
 * with, and this draws those bitmaps onto the pages it is given.
 */
class MoosiacPrintModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = NAME

    @ReactMethod
    fun printPages(jobName: String, pages: ReadableArray, promise: Promise) {
        val bitmaps = decode(pages)
        if (bitmaps.isEmpty()) {
            promise.reject("no_pages", "There was nothing to print.")
            return
        }

        /*
          Through the react context, not the deprecated
          `ReactContextBaseJavaModule.getCurrentActivity()` — that one is a
          Kotlin function rather than a synthesised property, and is on its way
          out as of 0.80.
        */
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            // No activity means no window to raise the print dialog over.
            promise.reject("no_activity", "The app is not on screen.")
            return
        }

        activity.runOnUiThread {
            val manager =
                activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
            val name = jobName.ifBlank { "Score" }
            manager.print(
                name,
                ScorePrintAdapter(
                    reactApplicationContext.applicationContext,
                    name,
                    bitmaps,
                    promise,
                ),
                PrintAttributes.Builder().build(),
            )
        }
    }

    /**
     * The page images, in order.
     *
     * A page whose base64 does not decode is skipped rather than substituted:
     * printing a blank where music should be is worse than printing a shorter
     * part, because only one of those is noticeable.
     */
    private fun decode(pages: ReadableArray): List<Bitmap> {
        val out = mutableListOf<Bitmap>()
        for (i in 0 until pages.size()) {
            val base64 = pages.getMap(i)?.getString("base64") ?: continue
            val bytes = runCatching { Base64.decode(base64, Base64.DEFAULT) }
                .getOrNull() ?: continue
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.let(out::add)
        }
        return out
    }

    companion object {
        const val NAME = "MoosiacPrint"
    }
}

/**
 * One bitmap per page, drawn to fit.
 *
 * `PrintDocumentAdapter` is called back twice: once to lay out (which is where
 * the page count comes from) and once to write. Both have to answer, or the
 * print dialog waits forever with a spinner.
 */
private class ScorePrintAdapter(
    private val context: Context,
    private val jobName: String,
    private val bitmaps: List<Bitmap>,
    private val promise: Promise,
) : PrintDocumentAdapter() {

    private var attributes: PrintAttributes? = null
    /** Settled once: a promise resolved twice is a crash in release builds. */
    private var settled = false

    override fun onLayout(
        oldAttributes: PrintAttributes?,
        newAttributes: PrintAttributes?,
        cancellationSignal: CancellationSignal?,
        callback: LayoutResultCallback,
        extras: Bundle?,
    ) {
        attributes = newAttributes
        if (cancellationSignal?.isCanceled == true) {
            callback.onLayoutCancelled()
            return
        }
        val info = PrintDocumentInfo.Builder("$jobName.pdf")
            .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
            .setPageCount(bitmaps.size)
            .build()
        // `true` for changed: the content is new every time this adapter is
        // built, so claiming otherwise leaves the framework showing a stale
        // preview.
        callback.onLayoutFinished(info, true)
    }

    override fun onWrite(
        ranges: Array<out PageRange>?,
        destination: ParcelFileDescriptor,
        cancellationSignal: CancellationSignal?,
        callback: WriteResultCallback,
    ) {
        val document = PrintedPdfDocument(context, attributes ?: return)
        try {
            for ((index, bitmap) in bitmaps.withIndex()) {
                if (cancellationSignal?.isCanceled == true) {
                    callback.onWriteCancelled()
                    document.close()
                    return
                }
                val page = document.startPage(index)
                val content = page.info.contentRect
                page.canvas.drawBitmap(
                    bitmap,
                    null,
                    fit(bitmap, content),
                    null,
                )
                document.finishPage(page)
            }
            FileOutputStream(destination.fileDescriptor).use(document::writeTo)
            callback.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
            settle(true)
        } catch (error: Exception) {
            callback.onWriteFailed(error.message)
            settle(false)
        } finally {
            document.close()
        }
    }

    override fun onFinish() {
        // Reached on cancel as well as success, which is what makes cancelling
        // resolve false rather than leaving the promise pending forever.
        settle(false)
    }

    private fun settle(printed: Boolean) {
        if (settled) return
        settled = true
        promise.resolve(printed)
    }

    /**
     * The bitmap centred in `content`, scaled to fit without distorting it.
     *
     * Stretching to the content rect would change the aspect ratio of the
     * staves, which on a printed part reads as badly engraved music rather
     * than as a scaling mistake.
     */
    private fun fit(bitmap: Bitmap, content: Rect): Rect {
        val scale = minOf(
            content.width().toFloat() / bitmap.width,
            content.height().toFloat() / bitmap.height,
        )
        val width = (bitmap.width * scale).toInt()
        val height = (bitmap.height * scale).toInt()
        val left = content.left + (content.width() - width) / 2
        val top = content.top + (content.height() - height) / 2
        return Rect(left, top, left + width, top + height)
    }
}
