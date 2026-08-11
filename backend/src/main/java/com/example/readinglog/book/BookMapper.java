package com.example.readinglog.book;

import java.util.List;
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
}
