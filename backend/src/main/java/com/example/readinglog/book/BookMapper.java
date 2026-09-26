package com.example.readinglog.book;

import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface BookMapper {

  /**
   * Owner scoping lives in the SQL, not in Java. A caller that forgets to filter afterwards would
   * leak other users' rows silently; here it is impossible to get the rows in the first place.
   *
   * <p>The ordering matches {@code books_user_id_created_at_idx} in {@code V1__init.sql}.
   */
  @Select(
      """
      SELECT id, user_id, title, author, isbn, total_pages, current_page,
             status, rating, note, created_at, updated_at
        FROM books
       WHERE user_id = #{userId}
       ORDER BY created_at DESC, id DESC
       LIMIT #{limit} OFFSET #{offset}
      """)
  List<Book> findByUserId(
      @Param("userId") long userId, @Param("limit") int limit, @Param("offset") int offset);

  /**
   * Insert declared as {@code @Select} so PostgreSQL's {@code RETURNING} hands back the generated
   * row in one round trip. The usual {@code @Insert} + {@code @Options(useGeneratedKeys = true)}
   * writes the key back onto a mutable property, which a {@code record} does not have.
   *
   * <p>{@code flushCache = true} because MyBatis treats an {@code @Select} as a read and caches its
   * result for the session: two calls with identical arguments inside one transaction would return
   * the first row instead of inserting a second. It does not matter with today's single caller, and
   * it would be a silent lost write the moment a second one appears.
   *
   * <p>{@code created_at} / {@code updated_at} / {@code current_page} come from the column defaults
   * rather than from the caller.
   */
  @Select(
      """
      INSERT INTO books (user_id, title, author, isbn, total_pages, status)
      VALUES (#{userId}, #{title}, #{author}, #{isbn}, #{totalPages}, #{status})
      RETURNING id, user_id, title, author, isbn, total_pages, current_page,
                status, rating, note, created_at, updated_at
      """)
  @Options(flushCache = Options.FlushCachePolicy.TRUE)
  Book insert(
      @Param("userId") long userId,
      @Param("title") String title,
      @Param("author") String author,
      @Param("isbn") String isbn,
      @Param("totalPages") Integer totalPages,
      @Param("status") BookStatus status);

  /**
   * Owner-scoped like {@link #findByUserId}: another user's id finds nothing, same as a missing
   * one.
   */
  @Select(
      """
      SELECT id, user_id, title, author, isbn, total_pages, current_page,
             status, rating, note, created_at, updated_at
        FROM books
       WHERE id = #{id} AND user_id = #{userId}
      """)
  Book findByIdAndUserId(@Param("id") long id, @Param("userId") long userId);

  /**
   * Full replacement of the fields a client may edit, returning the updated row — {@code null} when
   * no row matched. Declared as {@code @Select} with {@code flushCache} for the reasons {@link
   * #insert} documents.
   *
   * <p>{@code current_page} / {@code rating} / {@code note} are left alone: they have their own
   * write paths ({@link #updateProgress} for the page).
   *
   * <p>A {@code totalPages} below the stored {@code current_page} matches no row, so the caller
   * sees {@code null} and has to tell that apart from a missing book. The guard sits in the {@code
   * WHERE} clause rather than in a read-then-write so the check and the write see the same row. The
   * casts are needed because PostgreSQL cannot infer a type for a bare {@code NULL} parameter.
   */
  @Select(
      """
      UPDATE books
         SET title = #{title}, author = #{author}, isbn = #{isbn},
             total_pages = #{totalPages}, status = #{status}, updated_at = now()
       WHERE id = #{id} AND user_id = #{userId}
         AND (CAST(#{totalPages} AS INTEGER) IS NULL
              OR current_page <= CAST(#{totalPages} AS INTEGER))
      RETURNING id, user_id, title, author, isbn, total_pages, current_page,
                status, rating, note, created_at, updated_at
      """)
  @Options(flushCache = Options.FlushCachePolicy.TRUE)
  Book update(
      @Param("id") long id,
      @Param("userId") long userId,
      @Param("title") String title,
      @Param("author") String author,
      @Param("isbn") String isbn,
      @Param("totalPages") Integer totalPages,
      @Param("status") BookStatus status);

  /**
   * Records the page the reader is on, returning the updated row — {@code null} when no row
   * matched, which is either a missing book or a {@code currentPage} beyond {@code total_pages}.
   * The bound is in the {@code WHERE} clause for the reason {@link #update} gives.
   */
  @Select(
      """
      UPDATE books
         SET current_page = #{currentPage}, updated_at = now()
       WHERE id = #{id} AND user_id = #{userId}
         AND (total_pages IS NULL OR #{currentPage} <= total_pages)
      RETURNING id, user_id, title, author, isbn, total_pages, current_page,
                status, rating, note, created_at, updated_at
      """)
  @Options(flushCache = Options.FlushCachePolicy.TRUE)
  Book updateProgress(
      @Param("id") long id, @Param("userId") long userId, @Param("currentPage") int currentPage);

  /**
   * @return the number of rows deleted — 0 when the book is missing or not the caller's
   */
  @Delete("DELETE FROM books WHERE id = #{id} AND user_id = #{userId}")
  int delete(@Param("id") long id, @Param("userId") long userId);
}
